import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { RequireExternalDnp } from '@/components/auth/RequireExternalDnp';
import { NotFound } from '@/pages/NotFound';

const AppShell = lazy(() => import('@/AppShell'));

const Dashboard = lazy(() =>
  import('@/pages/DashboardEntry').then((module) => ({ default: module.DashboardEntry }))
);
const InstansiProfil = lazy(() =>
  import('@/pages/InformasiInstansi').then((module) => ({ default: module.Instansi }))
);
const InstansiFasilitas = lazy(() =>
  import('@/pages/InstansiFasilitas').then((module) => ({
    default: module.InstansiFasilitas,
  }))
);
const InstansiOrganisasi = lazy(() =>
  import('@/pages/InstansiOrganisasi').then((module) => ({
    default: module.InstansiOrganisasi,
  }))
);
const InstansiPersonil = lazy(() =>
  import('@/pages/InstansiPersonil').then((module) => ({
    default: module.InstansiPersonil,
  }))
);
const InstansiSertifikat = lazy(() =>
  import('@/pages/InstansiSertifikat').then((module) => ({
    default: module.InstansiSertifikat,
  }))
);
const AgendaPengawasan = lazy(() =>
  import('@/pages/AgendaPengawasan').then((module) => ({
    default: module.AgendaPengawasan,
  }))
);
const AuditResults = lazy(() =>
  import('@/pages/SelfAssessmentResultList').then((module) => ({
    default: module.AuditResults,
  }))
);
const MonitoringResults = lazy(() =>
  import('@/pages/SelfAssessmentResultList').then((module) => ({
    default: module.MonitoringResults,
  }))
);
const InspeksiResults = lazy(() =>
  import('@/pages/SelfAssessmentResultList').then((module) => ({
    default: module.InspeksiResults,
  }))
);
const SurveillanceResults = lazy(() =>
  import('@/pages/SelfAssessmentResultList').then((module) => ({
    default: module.SurveillanceResults,
  }))
);
const AuditDetail = lazy(() =>
  import('@/pages/AuditDetail').then((module) => ({ default: module.AuditDetail }))
);
const AuditSelfAssessment = lazy(() =>
  import('@/pages/AuditSelfAssessmentPage').then((module) => ({
    default: module.AuditSelfAssessmentPage,
  }))
);
const AuditReviewUnitSafety = lazy(() =>
  import('@/pages/AuditReviewUnitSafety').then((module) => ({
    default: module.AuditReviewUnitSafety,
  }))
);
const MonitoringReviewUnitSafety = lazy(() =>
  import('@/pages/MonitoringReviewUnitSafety').then((module) => ({
    default: module.MonitoringReviewUnitSafety,
  }))
);
const MonitoringSelfAssessment = lazy(() =>
  import('@/pages/MonitoringSelfAssessmentPage').then((module) => ({
    default: module.MonitoringSelfAssessmentPage,
  }))
);
const MonitoringResultDetail = lazy(() =>
  import('@/pages/MonitoringResultDetail').then((module) => ({
    default: module.MonitoringResultDetail,
  }))
);
const AuditCapDraft = lazy(() =>
  import('@/pages/AuditCapDraft').then((module) => ({
    default: module.AuditCapDraft,
  }))
);
const AuditCapDraftList = lazy(() =>
  import('@/pages/AuditCapDraftList').then((module) => ({
    default: module.AuditCapDraftList,
  }))
);
const AuditCapFulfillment = lazy(() =>
  import('@/pages/AuditCapFulfillment').then((module) => ({
    default: module.AuditCapFulfillment,
  }))
);
const AuditCapFulfillmentList = lazy(() =>
  import('@/pages/AuditCapFulfillmentList').then((module) => ({
    default: module.AuditCapFulfillmentList,
  }))
);
const Cap = lazy(() => import('@/pages/Cap').then((module) => ({ default: module.Cap })));
const InspeksiPQ = lazy(() =>
  import('@/pages/InspeksiPQ').then((module) => ({ default: module.InspeksiPQ }))
);
const InspeksiSelfAssessment = lazy(() =>
  import('@/pages/InspeksiSelfAssessmentPage').then((module) => ({
    default: module.InspeksiSelfAssessmentPage,
  }))
);
const InspeksiReviewUnitSafety = lazy(() =>
  import('@/pages/InspeksiReviewUnitSafety').then((module) => ({
    default: module.InspeksiReviewUnitSafety,
  }))
);
const InspeksiCapDraft = lazy(() =>
  import('@/pages/InspeksiCapDraft').then((module) => ({
    default: module.InspeksiCapDraft,
  }))
);
const InspeksiCapDraftList = lazy(() =>
  import('@/pages/InspeksiCapDraftList').then((module) => ({
    default: module.InspeksiCapDraftList,
  }))
);
const InspeksiCapFulfillment = lazy(() =>
  import('@/pages/InspeksiCapFulfillment').then((module) => ({
    default: module.InspeksiCapFulfillment,
  }))
);
const InspeksiCapFulfillmentList = lazy(() =>
  import('@/pages/InspeksiCapFulfillmentList').then((module) => ({
    default: module.InspeksiCapFulfillmentList,
  }))
);
const SurveillanceSelfAssessment = lazy(() =>
  import('@/pages/SurveillanceSelfAssessment').then((module) => ({
    default: module.SurveillanceSelfAssessment,
  }))
);
const SurveillanceReviewUnitSafety = lazy(() =>
  import('@/pages/SurveillanceReviewUnitSafety').then((module) => ({
    default: module.SurveillanceReviewUnitSafety,
  }))
);
const SurveillanceCapDraft = lazy(() =>
  import('@/pages/SurveillanceCapDraft').then((module) => ({
    default: module.SurveillanceCapDraft,
  }))
);
const SurveillanceCapDraftList = lazy(() =>
  import('@/pages/SurveillanceCapDraftList').then((module) => ({
    default: module.SurveillanceCapDraftList,
  }))
);
const SurveillanceCapFulfillment = lazy(() =>
  import('@/pages/SurveillanceCapFulfillment').then((module) => ({
    default: module.SurveillanceCapFulfillment,
  }))
);
const SurveillanceCapFulfillmentList = lazy(() =>
  import('@/pages/SurveillanceCapFulfillmentList').then((module) => ({
    default: module.SurveillanceCapFulfillmentList,
  }))
);
const ExternalDnpAuditCapDraftList = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpAuditCapDraftList').then((module) => ({
    default: module.ExternalDnpAuditCapDraftList,
  }))
);
const ExternalDnpAuditCapDraft = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpAuditCapDraft').then((module) => ({
    default: module.ExternalDnpAuditCapDraft,
  }))
);
const ExternalDnpAuditCapFulfillmentList = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpAuditCapFulfillmentList').then((module) => ({
    default: module.ExternalDnpAuditCapFulfillmentList,
  }))
);
const ExternalDnpAuditCapFulfillment = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpAuditCapFulfillment').then((module) => ({
    default: module.ExternalDnpAuditCapFulfillment,
  }))
);
const ExternalDnpInspeksiCapDraftList = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpInspeksiCapDraftList').then((module) => ({
    default: module.ExternalDnpInspeksiCapDraftList,
  }))
);
const ExternalDnpInspeksiCapDraft = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpInspeksiCapDraft').then((module) => ({
    default: module.ExternalDnpInspeksiCapDraft,
  }))
);
const ExternalDnpInspeksiCapFulfillmentList = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpInspeksiCapFulfillmentList').then(
    (module) => ({
      default: module.ExternalDnpInspeksiCapFulfillmentList,
    })
  )
);
const ExternalDnpInspeksiCapFulfillment = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpInspeksiCapFulfillment').then((module) => ({
    default: module.ExternalDnpInspeksiCapFulfillment,
  }))
);
const ExternalDnpSurveillanceCapDraftList = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpSurveillanceCapDraftList').then(
    (module) => ({
      default: module.ExternalDnpSurveillanceCapDraftList,
    })
  )
);
const ExternalDnpSurveillanceCapDraft = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpSurveillanceCapDraft').then((module) => ({
    default: module.ExternalDnpSurveillanceCapDraft,
  }))
);
const ExternalDnpSurveillanceCapFulfillmentList = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpSurveillanceCapFulfillmentList').then(
    (module) => ({
      default: module.ExternalDnpSurveillanceCapFulfillmentList,
    })
  )
);
const ExternalDnpSurveillanceCapFulfillment = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpSurveillanceCapFulfillment').then(
    (module) => ({
      default: module.ExternalDnpSurveillanceCapFulfillment,
    })
  )
);
const ExternalDnpExportDocument = lazy(() =>
  import('@/pages/external-dnp/ExternalDnpExportDocument').then((module) => ({
    default: module.ExternalDnpExportDocument,
  }))
);
const Temuan = lazy(() =>
  import('@/pages/Temuan').then((module) => ({ default: module.Temuan }))
);
const Login = lazy(() =>
  import('@/pages/Login').then((module) => ({ default: module.Login }))
);
const AuthCallback = lazy(() =>
  import('@/pages/AuthCallback').then((module) => ({ default: module.AuthCallback }))
);
const Profile = lazy(() =>
  import('@/pages/Profile').then((module) => ({ default: module.Profile }))
);
const AdminDashboard = lazy(() =>
  import('@/pages/admin/AdminDashboard').then((module) => ({
    default: module.AdminDashboard,
  }))
);
const AdminUserManagement = lazy(() =>
  import('@/pages/admin/UserManagement').then((module) => ({
    default: module.UserManagement,
  }))
);
const AdminSelfAssessment = lazy(() =>
  import('@/pages/admin/SelfAssessmentQuestions').then((module) => ({
    default: module.SelfAssessmentQuestions,
  }))
);
const AdminSelfAssessmentSessions = lazy(() =>
  import('@/pages/admin/SelfAssessmentSessions').then((module) => ({
    default: module.SelfAssessmentSessions,
  }))
);
const AdminMonitoringReviews = lazy(() =>
  import('@/pages/admin/MonitoringReviews').then((module) => ({
    default: module.MonitoringReviews,
  }))
);
const AdminMonitoringReviewDetail = lazy(() =>
  import('@/pages/admin/MonitoringReviewDetail').then((module) => ({
    default: module.MonitoringReviewDetail,
  }))
);
const AdminSelfAssessmentReviews = lazy(() =>
  import('@/pages/admin/SelfAssessmentReviews').then((module) => ({
    default: module.SelfAssessmentReviews,
  }))
);
const AdminSelfAssessmentExportDnp = lazy(() =>
  import('@/pages/admin/SelfAssessmentExportDnp').then((module) => ({
    default: module.SelfAssessmentExportDnp,
  }))
);
const AdminSelfAssessmentCapReviews = lazy(() =>
  import('@/pages/admin/SelfAssessmentCapReviews').then((module) => ({
    default: module.SelfAssessmentCapReviews,
  }))
);
const AdminSelfAssessmentCapReviewList = lazy(() =>
  import('@/pages/admin/SelfAssessmentCapReviewList').then((module) => ({
    default: module.SelfAssessmentCapReviewList,
  }))
);
const AdminSelfAssessmentCapFulfillmentList = lazy(() =>
  import('@/pages/admin/SelfAssessmentCapFulfillmentList').then((module) => ({
    default: module.SelfAssessmentCapFulfillmentList,
  }))
);
const AdminSelfAssessmentCapFulfillmentDetail = lazy(() =>
  import('@/pages/admin/SelfAssessmentCapFulfillmentDetail').then((module) => ({
    default: module.SelfAssessmentCapFulfillmentDetail,
  }))
);
const AdminWhatsappApi = lazy(() =>
  import('@/pages/admin/WhatsappApi').then((module) => ({
    default: module.WhatsappApi,
  }))
);
const AdminWhatsappSelfAssessment = lazy(() =>
  import('@/pages/admin/WhatsappSelfAssessment').then((module) => ({
    default: module.WhatsappSelfAssessment,
  }))
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/portal-admin"
          element={<Navigate to="/admin" replace />}
        />
        <Route
          path="/"
          element={
            <Suspense fallback={null}>
              <AppShell />
            </Suspense>
          }
        >
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/dashboard"
            element={<Navigate to="/admin" replace />}
          />
          <Route
            path="admin/users"
            element={
              <RequireAdmin>
                <AdminUserManagement />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment"
            element={
              <RequireAdmin>
                <AdminSelfAssessment />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-sessions"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentSessions />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/monitoring"
            element={<Navigate to="/admin/monitoring-reviews" replace />}
          />
          <Route
            path="admin/monitoring-reviews"
            element={
              <RequireAdmin>
                <AdminMonitoringReviews />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/monitoring-reviews/:sessionAreaId"
            element={
              <RequireAdmin>
                <AdminMonitoringReviewDetail />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-reviews"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentReviews />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-export-dnp"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentExportDnp />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-cap-reviews"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentCapReviewList />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-cap-reviews/:sessionAreaId"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentCapReviews />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-cap-fulfillments"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentCapFulfillmentList />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/self-assessment-cap-fulfillments/:sessionAreaId"
            element={
              <RequireAdmin>
                <AdminSelfAssessmentCapFulfillmentDetail />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/whatsapp"
            element={
              <RequireAdmin>
                <Navigate to="/admin/whatsapp/external-dnp" replace />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/whatsapp/external-dnp"
            element={
              <RequireAdmin>
                <AdminWhatsappApi />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/whatsapp/self-assessment"
            element={
              <RequireAdmin>
                <AdminWhatsappSelfAssessment />
              </RequireAdmin>
            }
          />
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="informasi">
            <Route path="instansi">
              <Route index element={<Navigate to="profil" replace />} />
              <Route path="profil" element={<InstansiProfil />} />
              <Route path="fasilitas" element={<InstansiFasilitas />} />
              <Route path="organisasi" element={<InstansiOrganisasi />} />
              <Route path="personil" element={<InstansiPersonil />} />
              <Route path="sertifikat" element={<InstansiSertifikat />} />
            </Route>
            <Route path="agenda-pengawasan" element={<AgendaPengawasan />} />
          </Route>
          <Route
            path="audit/protocol-question/self-assessment"
            element={<AuditSelfAssessment />}
          />
          <Route
            path="audit/protocol-question/hasil-review-dgca"
            element={<AuditReviewUnitSafety />}
          />
          <Route
            path="monitoring/protocol-question/self-assessment"
            element={<MonitoringSelfAssessment />}
          />
          <Route
            path="monitoring/protocol-question/self-assessment/:scope/:sessionAreaId"
            element={<Navigate to="/monitoring/protocol-question/self-assessment" replace />}
          />
          <Route
            path="monitoring/protocol-question/hasil-review-dgca"
            element={<MonitoringReviewUnitSafety />}
          />
          <Route
            path="monitoring/hasil/:sessionAreaId"
            element={<MonitoringResultDetail />}
          />
          <Route path="audit/cap/penyusunan" element={<AuditCapDraftList />} />
          <Route
            path="audit/cap/penyusunan/:sessionAreaId"
            element={<AuditCapDraft />}
          />
          <Route path="audit/cap/pemenuhan" element={<AuditCapFulfillmentList />} />
          <Route
            path="audit/cap/pemenuhan/:sessionAreaId"
            element={<AuditCapFulfillment />}
          />
          <Route path="audit" element={<AuditResults />} />
          <Route path="audit/:id" element={<AuditDetail />} />
          <Route path="temuan" element={<Temuan />} />
          <Route path="cap" element={<Cap />} />
          <Route
            path="inspeksi/protocol-question/self-assessment"
            element={<InspeksiSelfAssessment />}
          />
          <Route
            path="inspeksi/protocol-question/hasil-review-dgca"
            element={<InspeksiReviewUnitSafety />}
          />
          <Route path="inspeksi/cap/penyusunan" element={<InspeksiCapDraftList />} />
          <Route
            path="inspeksi/cap/penyusunan/:sessionAreaId"
            element={<InspeksiCapDraft />}
          />
          <Route path="inspeksi/cap/pemenuhan" element={<InspeksiCapFulfillmentList />} />
          <Route
            path="inspeksi/cap/pemenuhan/:sessionAreaId"
            element={<InspeksiCapFulfillment />}
          />
          <Route path="inspeksi" element={<InspeksiResults />} />
          <Route path="inspeksi/:id/pq" element={<InspeksiPQ />} />
          <Route
            path="surveillance/protocol-question/self-assessment"
            element={<SurveillanceSelfAssessment />}
          />
          <Route
            path="surveillance/protocol-question/hasil-review-dgca"
            element={<SurveillanceReviewUnitSafety />}
          />
          <Route
            path="surveillance/cap/penyusunan"
            element={<SurveillanceCapDraftList />}
          />
          <Route
            path="surveillance/cap/penyusunan/:sessionAreaId"
            element={<SurveillanceCapDraft />}
          />
          <Route
            path="surveillance/cap/pemenuhan"
            element={<SurveillanceCapFulfillmentList />}
          />
          <Route
            path="surveillance/cap/pemenuhan/:sessionAreaId"
            element={<SurveillanceCapFulfillment />}
          />
          <Route
            path="external-dnp/export-document"
            element={
              <RequireExternalDnp>
                <ExternalDnpExportDocument />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/audit/cap/penyusunan"
            element={
              <RequireExternalDnp>
                <ExternalDnpAuditCapDraftList />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/audit/cap/penyusunan/:sessionAreaId"
            element={
              <RequireExternalDnp>
                <ExternalDnpAuditCapDraft />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/audit/cap/pemenuhan"
            element={
              <RequireExternalDnp>
                <ExternalDnpAuditCapFulfillmentList />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/audit/cap/pemenuhan/:sessionAreaId"
            element={
              <RequireExternalDnp>
                <ExternalDnpAuditCapFulfillment />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/inspeksi/cap/penyusunan"
            element={
              <RequireExternalDnp>
                <ExternalDnpInspeksiCapDraftList />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/inspeksi/cap/penyusunan/:sessionAreaId"
            element={
              <RequireExternalDnp>
                <ExternalDnpInspeksiCapDraft />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/inspeksi/cap/pemenuhan"
            element={
              <RequireExternalDnp>
                <ExternalDnpInspeksiCapFulfillmentList />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/inspeksi/cap/pemenuhan/:sessionAreaId"
            element={
              <RequireExternalDnp>
                <ExternalDnpInspeksiCapFulfillment />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/surveillance/cap/penyusunan"
            element={
              <RequireExternalDnp>
                <ExternalDnpSurveillanceCapDraftList />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/surveillance/cap/penyusunan/:sessionAreaId"
            element={
              <RequireExternalDnp>
                <ExternalDnpSurveillanceCapDraft />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/surveillance/cap/pemenuhan"
            element={
              <RequireExternalDnp>
                <ExternalDnpSurveillanceCapFulfillmentList />
              </RequireExternalDnp>
            }
          />
          <Route
            path="external-dnp/surveillance/cap/pemenuhan/:sessionAreaId"
            element={
              <RequireExternalDnp>
                <ExternalDnpSurveillanceCapFulfillment />
              </RequireExternalDnp>
            }
          />
          <Route path="monitoring" element={<MonitoringResults />} />
          <Route path="surveillance" element={<SurveillanceResults />} />
        </Route>
        <Route
          path="*"
          element={
            <RequireAuth>
              <NotFound />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
