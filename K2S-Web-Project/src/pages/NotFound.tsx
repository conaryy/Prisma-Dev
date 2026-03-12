import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f7ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-[-120px] h-96 w-96 rounded-full bg-blue-200/60 blur-3xl motion-safe:animate-[float_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-140px] left-[-80px] h-96 w-96 rounded-full bg-sky-200/50 blur-3xl motion-safe:animate-[float_14s_ease-in-out_infinite]" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl motion-safe:animate-[float_10s_ease-in-out_infinite]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm">
              Error 404
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
                Halaman tidak ditemukan.
              </h1>
              <p className="text-sm text-slate-600 sm:text-base">
                URL yang kamu cari tidak tersedia. Bisa jadi sudah dipindah atau belum dibuat.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-blue-500 text-white hover:bg-blue-600">
                <Link to="/dashboard">Kembali ke Dashboard</Link>
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Halaman Sebelumnya
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Jika kamu merasa ini salah, hubungi admin atau cek ulang alamat.
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-12 hidden h-24 w-24 rounded-3xl border border-blue-100 bg-white/80 shadow-lg lg:block" />
            <div className="relative rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-base font-semibold text-white">
                    404
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Lokasi Hilang</div>
                    <div className="text-xs text-slate-500">Halaman tidak tersedia</div>
                  </div>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                  {location.pathname || '/'}
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="h-3 w-4/5 rounded-full bg-slate-200" />
                <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                <div className="h-3 w-1/2 rounded-full bg-slate-200" />
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-700">
                Pastikan alamat yang kamu masukkan sudah benar.
              </div>
            </div>
            <div className="absolute -bottom-6 right-8 hidden h-20 w-20 rounded-full border border-blue-100 bg-white/80 shadow-md lg:block" />
          </div>
        </div>
      </div>
    </div>
  );
}
