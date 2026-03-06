<?php
// Simple rules engine to determine CRM stage and blockers

class StageService
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function evaluateParticipant($participantId)
    {
        $blockers = [];
        $highestStage = 'lead';

        try {
            // 1. Check if participant exists
            $stmt = $this->pdo->prepare("SELECT * FROM participants WHERE id = ?");
            $stmt->execute([$participantId]);
            $participant = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$participant) {
                return ['stage' => 'unknown', 'blockers' => ['Participant not found']];
            }

            // 2. Check Missing Service Agreement
            $stmt = $this->pdo->prepare("SELECT id, signed_at FROM crm_service_agreements WHERE participant_id = ? ORDER BY id DESC LIMIT 1");
            $stmt->execute([$participantId]);
            $agreement = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$agreement || !$agreement['signed_at']) {
                $blockers[] = "Missing service agreement";
            } else {
                $highestStage = 'active'; // Minimal requirement to move past lead/qualified
            }

            // 3. Check Missing Consent
            $stmt = $this->pdo->prepare("SELECT id FROM consents WHERE participant_id = ? AND signed = 1");
            $stmt->execute([$participantId]);
            $consent = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$consent) {
                $blockers[] = "Missing consent";
            }

            // 4. Check Plan Expiration
            $stmt = $this->pdo->prepare("SELECT id, end_date FROM plans WHERE participant_id = ? ORDER BY id DESC LIMIT 1");
            $stmt->execute([$participantId]);
            $plan = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$plan) {
                $blockers[] = "No active plan";
            } else {
                $endDate = new DateTime($plan['end_date']);
                $now = new DateTime();
                if ($endDate < $now) {
                    $blockers[] = "Plan expired";
                }
            }

            // 5. Check No Sessions
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM crm_sessions WHERE participant_id = ?");
            $stmt->execute([$participantId]);
            $sessionCount = $stmt->fetchColumn();
            if ($sessionCount == 0 && $highestStage == 'active') {
                $blockers[] = "No sessions delivered yet";
            }

            // 6. Check Sessions Missing Evidence
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) FROM crm_sessions s 
                LEFT JOIN evidence e ON s.id = e.session_id 
                WHERE s.participant_id = ? AND e.id IS NULL
            ");
            $stmt->execute([$participantId]);
            $missingEvidenceCount = $stmt->fetchColumn();
            if ($missingEvidenceCount > 0) {
                $blockers[] = "{$missingEvidenceCount} session(s) missing evidence";
            } else if ($sessionCount > 0) {
                $highestStage = 'claim_ready';
            }

            // 7. Check Rejected Claims
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM claims WHERE participant_id = ? AND status = 'rejected'");
            $stmt->execute([$participantId]);
            $rejectedClaims = $stmt->fetchColumn();
            if ($rejectedClaims > 0) {
                $blockers[] = "{$rejectedClaims} rejected claim(s) require action";
            }

            // 8. Check Overdue Invoices
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM invoices WHERE participant_id = ? AND status = 'overdue'");
            $stmt->execute([$participantId]);
            $overdueInvoices = $stmt->fetchColumn();
            if ($overdueInvoices > 0) {
                $blockers[] = "{$overdueInvoices} overdue invoice(s)";
            }

            // Determine final stage based on rules (simple progression)
            if (!empty($blockers) && $highestStage != 'lead') {
                $highestStage = 'blocked'; // Or keep current but flagged
            }

            return [
                'stage' => $highestStage,
                'blockers' => $blockers
            ];

        } catch (Exception $e) {
            return ['stage' => 'error', 'blockers' => ['Engine Error: ' . $e->getMessage()]];
        }
    }
}
?>
