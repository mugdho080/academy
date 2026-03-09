<?php
// Set headers for JSON response
header('Content-Type: application/json');

// Include DB connection
require_once 'db_connect.php';

// Get the request method and URI
$method = $_SERVER['REQUEST_METHOD'];
$request_uri = $_SERVER['REQUEST_URI'];

// Clean up the URI to get the endpoint
// This handles cases like /academy/api/auth/login or just /auth/login
$script_name = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])); // Normalize Windows paths
$request_uri = str_replace('\\', '/', $_SERVER['REQUEST_URI']);

$endpoint = str_replace($script_name, '', $request_uri);
$endpoint = explode('?', $endpoint)[0];
$endpoint = '/' . ltrim($endpoint, '/'); // Ensure leading slash
$endpoint = rtrim($endpoint, '/');

// Optional: Normalize away .php for the switch
$clean_endpoint = str_replace('.php', '', $endpoint);

error_log("Debug: script_name=$script_name, request_uri=$request_uri, endpoint=$endpoint, clean=$clean_endpoint");

if (strpos($endpoint, '/update_db') !== false) {
    require __DIR__ . '/update_db.php';
    exit;
}

switch ($clean_endpoint) {
    case '/auth/login':
        require 'auth/login.php';
        break;
    case '/auth/logout':
        require 'auth/logout.php';
        break;
    case '/auth/signup':
        require 'auth/signup.php';
        break;
    case '/chapters':
    case '/learner/chapters':
        require 'learner/chapters.php';
        break;
    case '/learner/track_time':
        require 'learner/track_time.php';
        break;
    case '/learner/start_session':
        require 'learner/start_session.php';
        break;
    case '/learner/ping_session':
        require 'learner/ping_session.php';
        break;
    case '/learner/ping_active':
        require 'learner/ping_active.php';
        break;
    case '/learner/log_delta':
        require 'learner/log_delta.php';
        break;
    case '/learner/switch_context':
        require 'learner/switch_context.php';
        break;
    case '/learner/end_session':
        require 'learner/end_session.php';
        break;
    case '/learner/get_time_logs':
        require 'learner/get_time_logs.php';
        break;
    case '/learner/get_time_summary':
        require 'learner/get_time_summary.php';
        break;
    case '/learner/get_my_invoices':
        require 'learner/get_my_invoices.php';
        break;
    case '/learner/submit_agreement':
        require 'learner/submit_agreement.php';
        break;
    case '/learner/fetch_my_agreement':
        require 'learner/fetch_my_agreement.php';
        break;
    case '/admin/fetch_users':
        require 'admin/fetch_users.php';
        break;
    case '/admin/update_status':
        require 'admin/update_status.php';
        break;
    case '/admin/fetch_agreement':
        require 'admin/fetch_agreement.php';
        break;
    case '/admin/get_user_time_logs':
        require 'admin/get_user_time_logs.php';
        break;
    case '/admin/get_time_summary':
        require 'admin/get_time_summary.php';
        break;
    case '/admin/company_settings':
        require 'admin/company_settings.php';
        break;
    case '/admin/upload_company_logo':
        require 'admin/upload_company_logo.php';
        break;
    case '/admin/invoice_eligible_users':
        require 'admin/invoice_eligible_users.php';
        break;
    case '/admin/generate_draft_invoices':
        require 'admin/generate_draft_invoices.php';
        break;
    case '/admin/get_invoices':
        require 'admin/get_invoices.php';
        break;
    case '/admin/get_invoice_detail':
        require 'admin/get_invoice_detail.php';
        break;
    case '/admin/update_invoice':
        require 'admin/update_invoice.php';
        break;
    case '/admin/change_invoice_status':
        require 'admin/change_invoice_status.php';
        break;
    case '/admin/generate_invoice_pdf':
        require 'admin/generate_invoice_pdf.php';
        break;
    case '/admin/download_invoice':
        require 'admin/download_invoice.php';
        break;
    case '/admin/get_user_invoices':
        require 'admin/get_user_invoices.php';
        break;
    case '/admin/get_coach_events':
        require 'admin/get_coach_events.php';
        break;
    case '/admin/fetch_content':
        require 'admin/fetch_content.php';
        break;
    case '/admin/save_content':
        require 'admin/save_content.php';
        break;
    case '/admin/import_content':
        require 'admin/import_content_v2.php';
        break;
    case '/admin/add_level_json':
        require 'admin/add_level_json.php';
        break;
    case '/admin/where':
        require 'admin/where_am_i.php';
        break;
    case '/ai/chat':
        require 'ai/chat.php';
        break;
    case '/ai/coach_chat':
        require 'ai/coach_chat.php';
        break;
    case '/ai/get_coach_recommendation':
        require 'ai/get_coach_recommendation.php';
        break;
    case '/ai/log_coach_event':
        require 'ai/log_coach_event.php';
        break;
    case '/ai/get_coach_state':
        require 'ai/get_coach_state.php';
        break;
    case '/ai/update_coach_state':
        require 'ai/update_coach_state.php';
        break;
    case '/test':
        echo json_encode(['success' => true, 'message' => 'API is working!']);
        break;
    case '/test_db5':
        require 'test_db5.php';
        break;
    case '/debug_db':
        require 'debug_queries_v2.php';
        break;
    default:
        http_response_code(404);
        echo json_encode([
            'error' => 'Endpoint not found',
            'endpoint' => $endpoint,
            'clean_endpoint' => $clean_endpoint,
            'hex_clean' => bin2hex($clean_endpoint),
            'hex_expected' => bin2hex('/learner/start_session'),
            'script_name' => $script_name,
            'uri' => $request_uri,
            'method' => $method
        ]);
        break;
}
?>
