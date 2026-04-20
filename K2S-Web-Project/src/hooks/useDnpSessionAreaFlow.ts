import { useMemo, useState } from 'react';
import {
  fetchAdminSelfAssessmentExportDnpAreas,
  initAdminSelfAssessmentExportDnpSession,
  type SelfAssessmentExportDnpAreaTarget,
} from '@/lib/selfAssessment';

type UseDnpSessionAreaFlowOptions = {
  initialYear?: string;
};

type LoadAreasParams = {
  sessionAreaId: string;
};

export function useDnpSessionAreaFlow({
  initialYear = String(new Date().getFullYear()),
}: UseDnpSessionAreaFlowOptions = {}) {
  const [sessionId, setSessionId] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [year, setYear] = useState(initialYear);
  const [areas, setAreas] = useState<SelfAssessmentExportDnpAreaTarget[]>([]);
  const [selectedAreaKey, setSelectedAreaKey] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [areaLoading, setAreaLoading] = useState(false);

  const selectedArea = useMemo(
    () => areas.find((item) => `${item.fillCode1}::${item.fillCode2}` === selectedAreaKey) ?? null,
    [areas, selectedAreaKey]
  );

  const initializeSession = async () => {
    setCaptchaLoading(true);
    try {
      const data = await initAdminSelfAssessmentExportDnpSession();
      setSessionId(data.sessionId);
      setCaptchaUrl(data.captchaUrl);
      setCaptcha('');
      return data;
    } finally {
      setCaptchaLoading(false);
    }
  };

  const loadAreas = async ({ sessionAreaId }: LoadAreasParams) => {
    setAreaLoading(true);
    try {
      const yearNumber = Number(year);
      if (Number.isNaN(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
        throw new Error('Tahun DNP tidak valid.');
      }

      const response = await fetchAdminSelfAssessmentExportDnpAreas({
        sessionAreaId,
        sessionId,
        username,
        password,
        captcha,
        year: yearNumber,
      });

      setAreas(response.areas);
      setSelectedAreaKey(
        response.areas[0]
          ? `${response.areas[0].fillCode1}::${response.areas[0].fillCode2}`
          : ''
      );

      return response;
    } finally {
      setAreaLoading(false);
    }
  };

  return {
    sessionId,
    setSessionId,
    captchaUrl,
    setCaptchaUrl,
    username,
    setUsername,
    password,
    setPassword,
    captcha,
    setCaptcha,
    year,
    setYear,
    areas,
    setAreas,
    selectedAreaKey,
    setSelectedAreaKey,
    selectedArea,
    captchaLoading,
    areaLoading,
    initializeSession,
    loadAreas,
  };
}
