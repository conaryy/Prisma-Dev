<?php

use App\Http\Controllers\Api\AgendaController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CertificateController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FacilityController;
use App\Http\Controllers\Api\FacilityGroupController;
use App\Http\Controllers\Api\FindingController;
use App\Http\Controllers\Api\FollowUpController;
use App\Http\Controllers\Api\FollowUpEvidenceController;
use App\Http\Controllers\Api\FollowUpHistoryController;
use App\Http\Controllers\Api\GuideManualController;
use App\Http\Controllers\Api\InspectionController;
use App\Http\Controllers\Api\InstansiController;
use App\Http\Controllers\Api\MonitoringController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ExternalDnpCapController;
use App\Http\Controllers\Api\ExternalDnpExportDocumentController;
use App\Http\Controllers\Api\ExternalDnpWhatsappController;
use App\Http\Controllers\Api\SelfAssessmentResultController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\PersonilController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SelfAssessmentCategoryController;
use App\Http\Controllers\Api\SelfAssessmentAnswerController;
use App\Http\Controllers\Api\SelfAssessmentAreaQuestionCategoryController;
use App\Http\Controllers\Api\SelfAssessmentCapController;
use App\Http\Controllers\Api\SelfAssessmentEvidenceController;
use App\Http\Controllers\Api\SelfAssessmentExportDnpController;
use App\Http\Controllers\Api\SelfAssessmentImportDnpController;
use App\Http\Controllers\Api\SelfAssessmentQuestionController;
use App\Http\Controllers\Api\SelfAssessmentQuestionCategoryController;
use App\Http\Controllers\Api\SelfAssessmentReviewController;
use App\Http\Controllers\Api\SelfAssessmentSessionController;
use App\Http\Controllers\Api\SelfAssessmentSessionAreaController;
use App\Http\Controllers\Api\SelfAssessmentWhatsappSettingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::get('auth/sso-config', [AuthController::class, 'ssoConfig'])->middleware('throttle:60,1');
Route::get('notifications/stream', [NotificationController::class, 'stream'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('notifications.stream');

// Public signed routes for file download (no auth; signature required)
Route::get('self-assessment/evidence/{evidence}/signed', [SelfAssessmentEvidenceController::class, 'downloadSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('self-assessment.evidence.signed');
Route::get('self-assessment/results/files/{file}/signed', [SelfAssessmentResultController::class, 'downloadFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('self-assessment.results.file.signed');
Route::get('self-assessment/monitoring-results/files/{file}/signed', [SelfAssessmentResultController::class, 'downloadMonitoringFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('self-assessment.monitoring-results.file.signed');
Route::get('self-assessment/cap/fulfillment-files/{file}/signed', [SelfAssessmentCapController::class, 'downloadFulfillmentFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('self-assessment.cap.fulfillment-file.signed');
Route::get('self-assessment/cap/extensions/{extension}/signed', [SelfAssessmentCapController::class, 'downloadExtensionFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('self-assessment.cap.extension-file.signed');
Route::get('self-assessment/sessions/{session}/file/signed', [SelfAssessmentSessionController::class, 'downloadFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('self-assessment.session.file.signed');
Route::get('external-dnp/sync/captcha/{sessionId}', [ExternalDnpCapController::class, 'syncCaptcha'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('external-dnp.sync.captcha');
Route::get(
    'admin/self-assessment/questions/import-dnp/captcha/{sessionId}',
    [SelfAssessmentQuestionController::class, 'importDnpCaptcha']
)
    ->middleware(['signed', 'throttle:60,1'])
    ->name('admin.self-assessment.questions.import-dnp.captcha');
Route::get(
    'admin/self-assessment/export-dnp/captcha/{sessionId}',
    [SelfAssessmentExportDnpController::class, 'captcha']
)
    ->middleware(['signed', 'throttle:60,1'])
    ->name('admin.self-assessment.export-dnp.captcha');
Route::get(
    'admin/self-assessment/questions/export/signed',
    [SelfAssessmentQuestionController::class, 'exportDownloadSigned']
)
    ->middleware(['signed:relative', 'throttle:60,1'])
    ->name('admin.self-assessment.questions.export.signed');
Route::get('follow-ups/evidence/{evidence}/signed', [FollowUpEvidenceController::class, 'downloadSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('follow-ups.evidence.signed');
Route::get('external-dnp/cap/fulfillment-files/{file}/signed', [ExternalDnpCapController::class, 'downloadFulfillmentFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('external-dnp.cap.fulfillment-file.signed');
Route::get('external-dnp/cap/extensions/{extension}/signed', [ExternalDnpCapController::class, 'downloadExtensionFileSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('external-dnp.cap.extension-file.signed');
Route::get('guide/manual/{type}/signed', [GuideManualController::class, 'downloadSigned'])
    ->middleware(['signed:relative', 'throttle:60,1'])
    ->name('guide.manual.signed');
Route::get('guide/template/{type}/signed', [GuideManualController::class, 'downloadTemplateSigned'])
    ->middleware(['signed:relative', 'throttle:60,1'])
    ->name('guide.template.signed');

Route::middleware('auth.api')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::get('auth/session', [AuthController::class, 'session']);
    Route::get('dashboard/cap-summary', [DashboardController::class, 'capSummary']);
    Route::get('dashboard/user-alerts', [DashboardController::class, 'userAlerts']);
    Route::get('dashboard/cap-open-trend', [DashboardController::class, 'capOpenTrend']);
    Route::get('dashboard/cap-open-trend/external-dnp', [DashboardController::class, 'externalDnpCapTrend']);
    Route::get('dashboard/external-dnp-cap-list', [DashboardController::class, 'externalDnpCapList']);
    Route::get('dashboard/external-dnp-map-summary', [DashboardController::class, 'externalDnpMapSummary']);
    Route::get('dashboard/external-dnp-map-detail', [DashboardController::class, 'externalDnpMapDetail']);
    Route::get('dashboard/external-dnp-map-category-breakdown', [DashboardController::class, 'externalDnpMapCategoryBreakdown']);
    Route::get('guide/manual/user-url', [GuideManualController::class, 'userManualUrl']);
    Route::middleware('admin')->get('guide/manual/admin-url', [GuideManualController::class, 'adminManualUrl']);
    Route::middleware('admin')->get('guide/template/question-url', [GuideManualController::class, 'questionTemplateUrl']);

    Route::patch('profile', [ProfileController::class, 'update']);
    Route::post('profile/password', [ProfileController::class, 'changePassword']);
    
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('notifications/stream-url', [NotificationController::class, 'streamUrl']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::middleware('admin')->group(function () {
        Route::get('dashboard/admin-module-trend', [DashboardController::class, 'adminModuleTrend']);
        Route::get('dashboard/admin-insight-tables', [DashboardController::class, 'adminInsightTables']);
        Route::apiResource('users', UserController::class);
        Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
    });
    Route::get('instansi', [InstansiController::class, 'index']);
    Route::post('instansi', [InstansiController::class, 'store']);
    Route::get('instansi/{instansi}', [InstansiController::class, 'show']);
    Route::put('instansi/{instansi}', [InstansiController::class, 'update']);
    Route::get('facility-groups', [FacilityGroupController::class, 'index']);
    Route::post('facility-groups', [FacilityGroupController::class, 'store']);
    Route::delete('facility-groups/{facilityGroup}', [FacilityGroupController::class, 'destroy']);
    Route::apiResource('facilities', FacilityController::class);
    Route::apiResource('organizations', OrganizationController::class);
    Route::apiResource('personil', PersonilController::class);
    Route::apiResource('certificates', CertificateController::class);
    Route::get('agenda/self-assessment', [AgendaController::class, 'selfAssessmentSessions']);
    Route::apiResource('agenda', AgendaController::class)->only(['index', 'show']);
    Route::apiResource('audits', AuditController::class)->only(['index', 'show']);
    Route::apiResource('inspections', InspectionController::class)->only(['index', 'show']);
    Route::apiResource('monitoring', MonitoringController::class)->only(['index', 'show']);
    Route::apiResource('findings', FindingController::class)->only(['index', 'show']);
    Route::apiResource('follow-ups', FollowUpController::class)->only(['index', 'show']);

    Route::get('follow-ups/{followUp}/history', [FollowUpHistoryController::class, 'index']);

    Route::get('self-assessment/questions', [SelfAssessmentQuestionController::class, 'index']);
    Route::get('self-assessment/sessions', [SelfAssessmentSessionController::class, 'index']);
    Route::get('self-assessment/answers', [SelfAssessmentAnswerController::class, 'index']);
    Route::post('self-assessment/answers/bulk', [SelfAssessmentAnswerController::class, 'storeBulk']);
    Route::get('self-assessment/cap', [SelfAssessmentCapController::class, 'index']);
    Route::get('self-assessment/cap/list', [SelfAssessmentCapController::class, 'userList']);
    Route::get('self-assessment/cap/sessions', [SelfAssessmentCapController::class, 'userSessions']);
    Route::get('self-assessment/cap/fulfillment-sessions', [SelfAssessmentCapController::class, 'userFulfillmentSessions']);
    Route::post('self-assessment/cap', [SelfAssessmentCapController::class, 'store']);
    Route::post('self-assessment/cap/{cap}/fulfillments', [SelfAssessmentCapController::class, 'storeFulfillment']);
    Route::delete('self-assessment/cap/fulfillment-files/{file}', [SelfAssessmentCapController::class, 'destroyFulfillmentFile']);
    Route::post('self-assessment/cap/{cap}/extensions', [SelfAssessmentCapController::class, 'storeExtension']);
    Route::middleware('external-dnp-access')->group(function () {
        Route::get('external-dnp/cap', [ExternalDnpCapController::class, 'index']);
        Route::get('external-dnp/cap/sessions', [ExternalDnpCapController::class, 'sessions']);
        Route::get('external-dnp/export-document/items', [ExternalDnpExportDocumentController::class, 'items']);
        Route::post('external-dnp/export-document/generate', [ExternalDnpExportDocumentController::class, 'generate']);
        Route::get('external-dnp/export-document/download', [ExternalDnpExportDocumentController::class, 'download']);

        Route::middleware('admin')->group(function () {
            Route::post('external-dnp/sync', [ExternalDnpCapController::class, 'sync']);
            Route::post('external-dnp/sync/init', [ExternalDnpCapController::class, 'syncInit']);
            Route::post('external-dnp/sync/start', [ExternalDnpCapController::class, 'syncStart']);
            Route::post('external-dnp/sync/run', [ExternalDnpCapController::class, 'syncRun']);
            Route::get('external-dnp/sync/status', [ExternalDnpCapController::class, 'syncStatus']);
            Route::get('external-dnp/sync/jobs/{job}', [ExternalDnpCapController::class, 'syncJobStatus']);
            Route::post('external-dnp/cap', [ExternalDnpCapController::class, 'store']);
            Route::post('external-dnp/cap/{cap}/fulfillments', [ExternalDnpCapController::class, 'storeFulfillment']);
            Route::delete('external-dnp/cap/fulfillment-files/{file}', [ExternalDnpCapController::class, 'destroyFulfillmentFile']);
            Route::post('external-dnp/cap/{cap}/extensions', [ExternalDnpCapController::class, 'storeExtension']);
        });
    });
    Route::get('self-assessment/evidence', [SelfAssessmentEvidenceController::class, 'index']);
    Route::post('self-assessment/evidence', [SelfAssessmentEvidenceController::class, 'store']);
    Route::get('self-assessment/evidence/{evidence}/download', [SelfAssessmentEvidenceController::class, 'download']);
    Route::delete('self-assessment/evidence/{evidence}', [SelfAssessmentEvidenceController::class, 'destroy']);
    Route::get('self-assessment/reviews', [SelfAssessmentReviewController::class, 'index']);
    Route::get('self-assessment/reviews/{area}', [SelfAssessmentReviewController::class, 'show']);
    Route::get('self-assessment/results', [SelfAssessmentResultController::class, 'index']);
    Route::get('self-assessment/monitoring-results', [SelfAssessmentResultController::class, 'monitoringIndex']);

    Route::prefix('admin/self-assessment')->middleware('admin')->group(function () {
        Route::get('submissions', [SelfAssessmentReviewController::class, 'adminIndex']);
        Route::get('submissions/{area}', [SelfAssessmentReviewController::class, 'adminShow']);
        Route::post('export-dnp/init', [SelfAssessmentExportDnpController::class, 'init']);
        Route::post('export-dnp/areas', [SelfAssessmentExportDnpController::class, 'areas']);
        Route::post('export-dnp/import', [SelfAssessmentExportDnpController::class, 'import']);
        Route::post('export-dnp/run', [SelfAssessmentExportDnpController::class, 'importRun']);
        Route::post('export-dnp/matches', [SelfAssessmentExportDnpController::class, 'saveMatches']);
        Route::post('export-dnp/export', [SelfAssessmentExportDnpController::class, 'exportDraft']);
        Route::get('export-dnp/jobs/{job}', [SelfAssessmentExportDnpController::class, 'importStatus']);
        Route::post('import-dnp/inject', [SelfAssessmentImportDnpController::class, 'inject']);
        Route::get('import-dnp/jobs/{job}', [SelfAssessmentImportDnpController::class, 'injectStatus']);
        Route::post('answers/bulk', [SelfAssessmentAnswerController::class, 'adminStoreBulk']);
        Route::post('evidence', [SelfAssessmentEvidenceController::class, 'adminStore']);
        Route::delete('evidence/{evidence}', [SelfAssessmentEvidenceController::class, 'adminDestroy']);
        Route::post('reviews/bulk', [SelfAssessmentReviewController::class, 'storeBulk']);
        Route::post('results/finalize', [SelfAssessmentResultController::class, 'adminFinalize']);
        Route::delete('results/files/{file}', [SelfAssessmentResultController::class, 'adminDeleteFile']);
        Route::post('results/monitoring/finalize', [SelfAssessmentResultController::class, 'adminFinalizeMonitoring']);
        Route::delete('results/monitoring/files/{file}', [SelfAssessmentResultController::class, 'adminDeleteMonitoringFile']);
        Route::get('cap/sessions', [SelfAssessmentCapController::class, 'adminSessions']);
        Route::get('cap/sessions/{area}', [SelfAssessmentCapController::class, 'adminShow']);
        Route::get('cap-fulfillments/sessions', [SelfAssessmentCapController::class, 'adminFulfillmentSessions']);
        Route::get('cap-fulfillments/sessions/{area}', [SelfAssessmentCapController::class, 'adminFulfillmentShow']);
        Route::get('cap', [SelfAssessmentCapController::class, 'adminIndex']);
        Route::post('cap/reviews', [SelfAssessmentCapController::class, 'adminReview']);
        Route::post('cap/fulfillment-reviews', [SelfAssessmentCapController::class, 'adminFulfillmentReview']);
        Route::post('monitoring/reviews', [SelfAssessmentCapController::class, 'adminMonitoringReview']);

        Route::get('categories', [SelfAssessmentCategoryController::class, 'adminIndex']);
        Route::get('categories/available', [SelfAssessmentCategoryController::class, 'adminAvailable']);
        Route::post('categories', [SelfAssessmentCategoryController::class, 'store']);
        Route::patch('categories/{category}', [SelfAssessmentCategoryController::class, 'update']);
        Route::delete('categories/{category}', [SelfAssessmentCategoryController::class, 'destroy']);

        Route::get('question-categories', [SelfAssessmentQuestionCategoryController::class, 'adminIndex']);
        Route::get('question-categories/available', [SelfAssessmentQuestionCategoryController::class, 'adminAvailableByArea']);
        Route::post('question-categories', [SelfAssessmentQuestionCategoryController::class, 'store']);
        Route::patch('question-categories/{questionCategory}', [SelfAssessmentQuestionCategoryController::class, 'update']);
        Route::delete('question-categories/{questionCategory}', [SelfAssessmentQuestionCategoryController::class, 'destroy']);
        Route::get('area-question-categories', [SelfAssessmentAreaQuestionCategoryController::class, 'adminIndex']);
        Route::post('area-question-categories', [SelfAssessmentAreaQuestionCategoryController::class, 'store']);

        Route::get('questions', [SelfAssessmentQuestionController::class, 'adminIndex']);
        Route::post('questions', [SelfAssessmentQuestionController::class, 'store']);
        Route::post('questions/import', [SelfAssessmentQuestionController::class, 'import']);
        Route::post('questions/export-url', [SelfAssessmentQuestionController::class, 'exportUrl']);
        Route::post('questions/import-dnp/init', [SelfAssessmentQuestionController::class, 'importDnpInit']);
        Route::post('questions/import-dnp/fills', [SelfAssessmentQuestionController::class, 'importDnpFillOptions']);
        Route::post('questions/import-dnp/scrape', [SelfAssessmentQuestionController::class, 'importDnpScrape']);
        Route::post('questions/import-dnp/run', [SelfAssessmentQuestionController::class, 'importDnpScrapeRun']);
        Route::get('questions/import-dnp/jobs/{job}', [SelfAssessmentQuestionController::class, 'importDnpScrapeStatus']);
        Route::delete('questions', [SelfAssessmentQuestionController::class, 'adminDestroyAll']);
        Route::patch('questions/{question}', [SelfAssessmentQuestionController::class, 'update']);
        Route::delete('questions/{question}', [SelfAssessmentQuestionController::class, 'destroy']);

        Route::get('sessions', [SelfAssessmentSessionController::class, 'adminIndex']);
        Route::get('sessions/{session}', [SelfAssessmentSessionController::class, 'adminShow']);
        Route::post('sessions', [SelfAssessmentSessionController::class, 'adminStore']);
        Route::patch('sessions/{session}', [SelfAssessmentSessionController::class, 'adminUpdate']);
        Route::post('sessions/{session}/file', [SelfAssessmentSessionController::class, 'adminUploadFile']);
        Route::delete('sessions/{session}', [SelfAssessmentSessionController::class, 'adminDestroy']);

        Route::get('sessions/{session}/areas', [SelfAssessmentSessionAreaController::class, 'adminIndex']);
        Route::post('sessions/{session}/areas', [SelfAssessmentSessionAreaController::class, 'store']);
        Route::patch('areas/{area}', [SelfAssessmentSessionAreaController::class, 'update']);
        Route::delete('areas/{area}', [SelfAssessmentSessionAreaController::class, 'destroy']);
    });

    Route::middleware('admin')->group(function () {
        Route::apiResource('agenda', AgendaController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('audits', AuditController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('inspections', InspectionController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('monitoring', MonitoringController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('findings', FindingController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('follow-ups', FollowUpController::class)->only(['store', 'update', 'destroy']);
        Route::get('admin/whatsapp/options', [ExternalDnpWhatsappController::class, 'adminOptions']);
        Route::get('admin/whatsapp/session', [ExternalDnpWhatsappController::class, 'adminSessionStatus']);
        Route::post('admin/whatsapp/session/logout', [ExternalDnpWhatsappController::class, 'adminSessionLogout']);
        Route::post('admin/whatsapp/session/new', [ExternalDnpWhatsappController::class, 'adminSessionNew']);
        Route::get('admin/whatsapp/self-assessment/settings', [SelfAssessmentWhatsappSettingController::class, 'show']);
        Route::put('admin/whatsapp/self-assessment/settings', [SelfAssessmentWhatsappSettingController::class, 'update']);
        Route::post('admin/whatsapp/preview-batch', [ExternalDnpWhatsappController::class, 'adminPreviewBatch']);
        Route::post('admin/whatsapp/send', [ExternalDnpWhatsappController::class, 'adminSend']);
        Route::post('admin/whatsapp/send-batch', [ExternalDnpWhatsappController::class, 'adminSendBatch']);

        Route::post('follow-ups/{followUp}/history', [FollowUpHistoryController::class, 'store']);
        Route::post('follow-ups/{followUp}/evidence', [FollowUpEvidenceController::class, 'store']);
        Route::delete('follow-ups/{followUp}/evidence/{evidence}', [FollowUpEvidenceController::class, 'destroy']);
    });
});

Route::prefix('internal/whatsapp')->middleware('internal.api')->group(function () {
    Route::get('external-dnp/temuan', [ExternalDnpWhatsappController::class, 'temuan']);
});
