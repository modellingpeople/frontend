const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

export const API_BASE_URL = (
  process.env.REACT_APP_INFERENCE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, '');

function buildError(response, payload, fallbackMessage) {
  return new Error(payload?.detail || fallbackMessage || `Request failed with ${response.status}`);
}

async function parseJson(response, fallbackMessage) {
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error(fallbackMessage || `Request failed with ${response.status}`);
    }
    return null;
  }

  if (!response.ok) {
    throw buildError(response, payload, fallbackMessage);
  }

  return payload;
}

export function apiUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function uploadInferenceJob({ file, trajLength, guidanceMode }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('traj_length', String(trajLength));
  formData.append('guidance_mode', guidanceMode);

  const response = await fetch(apiUrl('/jobs/upload'), {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to create inference job.');
}

export async function fetchJob(jobId) {
  const response = await fetch(apiUrl(`/jobs/${jobId}`));
  return parseJson(response, 'Failed to fetch job status.');
}

export async function fetchScene(jobId) {
  const response = await fetch(apiUrl(`/jobs/${jobId}/scene`));
  return parseJson(response, 'Failed to load the inferred scene.');
}

export async function fetchArtifacts(jobId) {
  const response = await fetch(apiUrl(`/jobs/${jobId}/artifacts`));
  return parseJson(response, 'Failed to load job artifacts.');
}

export async function launchVisualizer(jobId) {
  const response = await fetch(apiUrl(`/jobs/${jobId}/visualize`), {
    method: 'POST',
  });
  return parseJson(response, 'Failed to launch visualizer.');
}
