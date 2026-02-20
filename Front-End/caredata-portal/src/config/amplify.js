/**
 * AWS Amplify config for Cognito (serverless auth).
 * Set in .env: VITE_USER_POOL_ID, VITE_CLIENT_ID, VITE_REGION, VITE_USE_COGNITO=true
 * For Google: configure Google IdP in Cognito and set VITE_COGNITO_DOMAIN (Hosted UI domain).
 */
import { Amplify } from "aws-amplify";
// Required so Amplify can exchange ?code= for tokens when user returns from Google sign-in
import "aws-amplify/auth/enable-oauth-listener";

const useCognito = import.meta.env.VITE_USE_COGNITO === "true" || import.meta.env.VITE_USE_COGNITO === "1";
const userPoolId = import.meta.env.VITE_USER_POOL_ID;
const clientId = import.meta.env.VITE_CLIENT_ID;
const region = import.meta.env.VITE_REGION || "ap-southeast-2";
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN; // e.g. your-domain.auth.ap-southeast-2.amazoncognito.com

if (useCognito && userPoolId && clientId && region) {
  const config = {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID || undefined,
        loginWith: {
          password: true,
          email: true,
          ...(cognitoDomain && {
            oauth: {
              domain: cognitoDomain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
              scopes: ["openid", "email", "profile"],
              redirectSignIn: [
                "http://localhost:5173/",
                "http://127.0.0.1:5173/",
                "https://care-data-portal.netlify.app/",
                "https://d2vw6ry5du4tco.cloudfront.net/",
              ],
              redirectSignOut: [
                "http://localhost:5173/",
                "http://localhost:5173",
                "http://127.0.0.1:5173/",
                "http://127.0.0.1:5173",
                "https://care-data-portal.netlify.app/",
                "https://d2vw6ry5du4tco.cloudfront.net/",
              ],
              responseType: "code",
              providers: ["Google"],
            },
          }),
        },
        signUpVerificationMethod: "code",
      },
    },
  };
  Amplify.configure(config);
}

export const isCognitoEnabled = () =>
  (import.meta.env.VITE_USE_COGNITO === "true" || import.meta.env.VITE_USE_COGNITO === "1") &&
  !!import.meta.env.VITE_USER_POOL_ID;

/** True when Google sign-in via Cognito Hosted UI is configured (VITE_COGNITO_DOMAIN set). */
export const isCognitoGoogleEnabled = () =>
  isCognitoEnabled() && !!import.meta.env.VITE_COGNITO_DOMAIN;
