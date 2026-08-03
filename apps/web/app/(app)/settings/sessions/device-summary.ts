/**
 * A best-effort, non-authoritative summary of a session's device/browser for the "manage devices"
 * list (task requirement #10). Not a fingerprint and not used for any security decision — purely
 * informational, same spirit as `@app/auth`'s own `deviceFingerprint` disclaimer ("not for security
 * isolation — only for new-device detection").
 */
export interface DeviceSummary {
  browser: string | null;
  os: string | null;
}

export function summarizeDevice(userAgent: string | null): DeviceSummary {
  if (!userAgent) return { browser: null, os: null };

  // Order matters: Chromium Edge's UA also matches "Chrome/" and "Safari/"; Chrome's UA also
  // matches "Safari/"; a real Safari's does not match "Chrome/". Most-specific token first.
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null;

  // iOS Safari's UA also contains the substring "Mac OS X" (as "like Mac OS X"), so the
  // iPhone/iPad/iPod check must come before the desktop-macOS one, which additionally requires
  // "Macintosh" — a token iOS UAs never include — to avoid misreading an iPhone as a Mac.
  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Macintosh/.test(userAgent) && /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Android/.test(userAgent)
          ? "Android"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;

  return { browser, os };
}
