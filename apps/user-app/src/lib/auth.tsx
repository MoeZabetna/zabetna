import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Auth for the User App.
 *
 * **Email + password**, because that is what the Figma design actually
 * specifies: Sign in (node 36:956) has Email and Password fields and a
 * "Forgot password" link, and Sign Up (36:994) collects Name, Email, Phone
 * number and Password. The "verify your number" / "verified" frames
 * (36:707 / 36:835) are a *phone* verification step that sits after
 * sign-up, and that step needs a paid SMS provider (Twilio/MessageBird)
 * configured in the Supabase dashboard — see docs/blueprint.html. Until
 * that exists the phone number is collected and stored on the profile
 * (payouts need it anyway) but not verified, and those two frames are not
 * wired up. Nothing here pretends a number has been verified when it
 * hasn't.
 *
 * Sign-up honours whichever "Confirm email" setting the Supabase project
 * has: if confirmations are on, `signUp` returns no session and the UI
 * says to check the inbox; if they're off, the returned session signs the
 * user straight in. Both paths are handled rather than assuming one.
 */

export type AuthState = {
  session: Session | null;
  /** True until the first session lookup resolves — prevents an auth-screen flash. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
};

export type SignUpInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type AuthActionResult = { ok: true } | { ok: false; message: string };

export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; message: string };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      // A sign-out or token refresh arriving before getSession resolves
      // should still clear the loading gate, or the app can hang on splash.
      setInitializing(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpResult> => {
    // full_name and phone ride along in user metadata so the
    // `handle_new_user` trigger can copy them onto the profile row it
    // creates. Writing to `profiles` from here instead would race that
    // trigger and fail RLS before the session exists.
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          phone: input.phone.trim(),
        },
      },
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, needsEmailConfirmation: data.session === null };
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, initializing, signIn, signUp, sendPasswordReset, signOut }),
    [session, initializing, signIn, signUp, sendPasswordReset, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
