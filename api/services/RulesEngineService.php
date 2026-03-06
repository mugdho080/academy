<?php
// Simple Rules Engine to evaluate NDIS Session compliance

class RulesEngineService
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function evaluateSession($sessionId)
    {
        $reasons = [];
        $status = "GREEN";
        $label = "✅ Claimable";

        try {
            // Fetch session, plan, line item, and evidence details
            $stmt = $this->pdo->prepare("
                SELECT 
                    s.session_date, s.attendance_status, s.participant_id,
                    pli.code as line_item_code, p.start_date, p.end_date,
                    e.session_note, e.attendance_confirmation, e.id as evidence_id
                FROM crm_sessions s
                JOIN plan_line_items pli ON s.line_item_id = pli.id
                JOIN plans p ON pli.plan_id = p.id
                LEFT JOIN evidence e ON s.id = e.session_id
                WHERE s.id = ?
            ");
            $stmt->execute([$sessionId]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$session) {
                return ['status' => 'RED', 'label' => '🔴 Invalid', 'reasons' => ['Session not found']];
            }

            // 1. RED CHECK: Plan Validity
            $sessionDate = new DateTime($session['session_date']);
            $planStart = new DateTime($session['start_date']);
            $planEnd = new DateTime($session['end_date']);

            if ($sessionDate < $planStart || $sessionDate > $planEnd) {
                $status = "RED";
                $reasons[] = "Session date is outside plan dates.";
            }

            // 2. RED CHECK: Attendance
            if ($session['attendance_status'] === 'cancelled') {
                $status = "RED";
                $reasons[] = "Session was cancelled by participant/provider.";
            }

            // 3. AMBER CHECK: Evidence
            if ($status !== "RED") {
                // Fetch rules for this line item
                $stmt = $this->pdo->prepare("SELECT required_evidence FROM line_item_rules WHERE line_item_code = ?");
                $stmt->execute([$session['line_item_code']]);
                $rule = $stmt->fetch(PDO::FETCH_ASSOC);

                $missingEvidence = false;
                if ($rule && $rule['required_evidence']) {
                    $required = json_decode($rule['required_evidence'], true);
                    foreach ($required as $field) {
                        // Check if evidence record exists and has the required field filled
                        if (!$session['evidence_id'] || empty($session[$field])) {
                            $missingEvidence = true;
                            $reasons[] = "Missing required evidence: " . str_replace('_', ' ', $field);
                        }
                    }
                } else {
                    // Default generic rule if no specific rule exists
                    if (!$session['evidence_id'] || empty($session['session_note'])) {
                        $missingEvidence = true;
                        $reasons[] = "Missing session note";
                    }
                }

                if ($missingEvidence) {
                    $status = "AMBER";
                }
            }

            // Set final labels
            if ($status === "RED") {
                $label = "🔴 Blocked";
            } elseif ($status === "AMBER") {
                $label = "🟠 Missing Evidence";
            }

            return [
                'status' => $status,
                'label' => $label,
                'reasons' => $reasons
            ];

        } catch (Exception $e) {
            return ['status' => 'RED', 'label' => '🔴 Error', 'reasons' => [$e->getMessage()]];
        }
    }

    public function evaluateClaim($claimId)
    {
        try {
            $stmt = $this->pdo->prepare("SELECT session_id FROM claim_lines WHERE claim_id = ?");
            $stmt->execute([$claimId]);
            $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($sessions)) {
                return ['status' => 'RED', 'label' => '🔴 Invalid Claim', 'reasons' => ['Claim has no sessions attached']];
            }

            $worstStatus = "GREEN";
            $allReasons = [];

            foreach ($sessions as $s) {
                $result = $this->evaluateSession($s['session_id']);

                // Collect all unique reasons
                foreach ($result['reasons'] as $r) {
                    if (!in_array($r, $allReasons)) {
                        $allReasons[] = "Session {$s['session_id']}: {$r}";
                    }
                }

                // Determine worst status (RED > AMBER > GREEN)
                if ($result['status'] === "RED") {
                    $worstStatus = "RED";
                } elseif ($result['status'] === "AMBER" && $worstStatus !== "RED") {
                    $worstStatus = "AMBER";
                }
            }

            $label = "✅ Claimable";
            if ($worstStatus === "RED") {
                $label = "🔴 Not Claimable";
            } elseif ($worstStatus === "AMBER") {
                $label = "🟠 Action Required";
            }

            return [
                'status' => $worstStatus,
                'label' => $label,
                'reasons' => $allReasons
            ];

        } catch (Exception $e) {
            return ['status' => 'RED', 'label' => '🔴 Error', 'reasons' => [$e->getMessage()]];
        }
    }
}
?>
