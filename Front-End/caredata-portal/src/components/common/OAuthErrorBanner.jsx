import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Shows a dismissible banner when the URL contains OAuth callback errors
 * (e.g. invalid_scope after Sign in with Google). Clears the query string when dismissed.
 */
export default function OAuthErrorBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const params = new URLSearchParams(location.search);
  const error = params.get("error");
  const errorDesc = decodeURIComponent(params.get("error_description") || "");
  
  // Log OAuth errors to console for debugging
  useEffect(() => {
    if (error && !dismissed) {
      console.error("[CareData OAuth] Error:", error, errorDesc || "(no description)");
      console.error("[CareData OAuth] Full URL:", window.location.href);
    }
  }, [error, errorDesc, dismissed]);
  
  // Check if we're on Cognito's error page (redirected back with error params)
  const isRedirectError = error === "400" || error === "invalid_request" || error === "access_denied";
  const isInvalidScope =
    error === "invalid_request" && errorDesc.toLowerCase().includes("invalid_scope");
  const isEmailAttributeError =
    errorDesc.length > 0 &&
    (errorDesc.toLowerCase().includes("user.email") || errorDesc.toLowerCase().includes("attribute cannot"));
  const isRedirectUriError =
    errorDesc.toLowerCase().includes("redirect_uri") ||
    errorDesc.toLowerCase().includes("redirect uri") ||
    errorDesc.toLowerCase().includes("invalid redirect");

  const showBanner = (isInvalidScope || isEmailAttributeError || isRedirectUriError || (isRedirectError && errorDesc)) && !dismissed;

  // Log OAuth errors to console for debugging
  useEffect(() => {
    if (error && !dismissed) {
      console.error("[CareData OAuth] Error:", error, errorDesc || "(no description)");
      console.error("[CareData OAuth] Full URL:", window.location.href);
    }
  }, [error, errorDesc, dismissed]);

  useEffect(() => {
    if (!error) setDismissed(false);
  }, [error]);

  if (!showBanner) return null;

  const clearAndDismiss = () => {
    setDismissed(true);
    const { pathname } = location;
    navigate(pathname || "/", { replace: true });
  };

  const title = isEmailAttributeError
    ? "Google sign-in failed: email attribute"
    : isRedirectUriError
      ? "Google sign-in failed: redirect URI mismatch"
      : "Google sign-in failed";
  const help = isEmailAttributeError
    ? "In Cognito: (1) Federated identity provider → Google → Attribute mapping: map Google “email” → user pool “email”. (2) If it still fails, your pool may have “email” as read-only: User pool → Sign-in experience → check which attributes are mutable; federated sign-in needs email to be writable, or create a new user pool with email mutable."
    : isRedirectUriError
      ? "Fix in Google Cloud Console: (1) Go to APIs & Services → Credentials → your OAuth 2.0 Client ID. (2) Add this exact redirect URI: https://caredata-portal.auth.ap-southeast-2.amazoncognito.com/oauth2/idpresponse (or your Cognito domain + /oauth2/idpresponse). (3) Save and wait 1-2 minutes, then try again."
      : errorDesc || "Check AWS Cognito and Google Cloud Console configuration. See DEPLOY-AWS-SERVERLESS.md for troubleshooting.";

  return (
    <div
      role="alert"
      className="bg-amber-900/90 text-amber-100 border-b border-amber-700 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-amber-200/90 mt-0.5">{help}</p>
        {errorDesc && (
          <p className="text-xs text-amber-300/80 mt-1 truncate" title={errorDesc}>
            Error: {errorDesc}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={clearAndDismiss}
        className="shrink-0 px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-amber-100 font-medium transition"
      >
        Dismiss
      </button>
    </div>
  );
}
