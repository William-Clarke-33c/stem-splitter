const PW_KEY = "stem-splitter-pw";

export function getPassword() {
  return sessionStorage.getItem(PW_KEY) ?? "";
}

export function setPassword(pw) {
  sessionStorage.setItem(PW_KEY, pw);
}

export function clearPassword() {
  sessionStorage.removeItem(PW_KEY);
}

export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const pw = getPassword();
  if (pw) headers.set("x-access-password", pw);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearPassword();
    window.dispatchEvent(new Event("auth:required"));
  }

  return res;
}
