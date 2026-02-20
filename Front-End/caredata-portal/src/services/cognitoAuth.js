/**
 * Cognito auth helpers (Amplify v6). Use when VITE_USE_COGNITO=true.
 * Returns idToken for sending to CareData API (Lambda verifies Cognito JWT).
 */
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
  confirmSignUp,
  confirmSignIn,
  resendSignUpCode,
} from "aws-amplify/auth";

export async function cognitoSignInWithGoogleRedirect(forceAccountSelection = false) {
  // If user wants to select account, sign out first to clear cached session
  if (forceAccountSelection) {
    try {
      await signOut();
    } catch (e) {
      // Ignore if already signed out
    }
  }
  
  await signInWithRedirect({
    provider: "Google",
    // Force Google to show account selection screen
    customState: forceAccountSelection ? "select_account" : undefined,
  });
}

export async function cognitoSignIn(email, password) {
  const { isSignedIn, nextStep } = await signIn({ username: email, password });
  if (nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_SMS_CODE" || nextStep?.signInStep === "CONFIRM_SIGN_UP") {
    return { needsConfirmation: true, nextStep };
  }
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return { token, isSignedIn };
}

export async function cognitoSignUp(email, password, firstName, lastName) {
  const { nextStep } = await signUp({
    username: email,
    password,
    options: {
      userAttributes: {
        given_name: firstName,
        family_name: lastName,
      },
    },
  });
  return { needsConfirmation: nextStep?.signUpStep === "CONFIRM_SIGN_UP", nextStep };
}

/** Confirm sign-up with the code sent to email (or SMS). Call after sign-up when needsConfirmation. */
export async function cognitoConfirmSignUp(username, confirmationCode) {
  await confirmSignUp({
    username,
    confirmationCode: confirmationCode.trim(),
  });
}

/** Resend the sign-up verification code to the user's email/phone. Use if the first email is slow or missing. */
export async function cognitoResendSignUpCode(username) {
  await resendSignUpCode({ username });
}

/** Confirm sign-in with the code (e.g. SMS or email MFA). Call when signIn returns needsConfirmation with CONFIRM_SIGN_IN_WITH_SMS_CODE etc. */
export async function cognitoConfirmSignIn(challengeResponse) {
  const { isSignedIn, nextStep } = await confirmSignIn({
    challengeResponse: challengeResponse.trim(),
  });
  if (nextStep?.signInStep === "DONE" || isSignedIn) {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return { token, isSignedIn: true };
  }
  return { needsConfirmation: true, nextStep };
}

export async function cognitoSignOut(options = {}) {
  try {
    // Use globalSignOut: false to avoid OAuth redirect issues
    // This signs out locally without redirecting to Cognito logout endpoint
    await signOut({
      globalSignOut: false, // Don't do global sign-out (avoids OAuth redirect)
    });
  } catch (e) {
    // If signOut fails (e.g., already signed out, or redirect error), that's okay
    // The error might be the 400 from Cognito logout redirect, which we can ignore
  }
}

export async function getCognitoIdToken() {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString() || null;
    return token;
  } catch (e) {
    return null;
  }
}

export async function getCognitoUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch {
    return null;
  }
}
