import {
  Action,
  Dispatch,
  PayloadAction,
  ThunkDispatch,
  createSlice,
} from "@reduxjs/toolkit";
import {
  IUserOpenProfileCreate,
  IUserProfile,
  IUserProfileUpdate,
} from "../interfaces";
import { RootState } from "../store";
import { addNotice, deleteNotices } from "./toastsSlice";
import { apiAuth } from "../api";
import {
  deleteTokens,
  getTokens,
} from "./tokensSlice";
import { PURGE } from "redux-persist";
import { tokenExpired } from "../utilities";

interface AuthState {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  fullName: string;
  password: boolean;
  latitude: number | null;
  longitude: number | null;
}

const initialState: AuthState = {
  id: "",
  email: "",
  is_active: false,
  is_superuser: false,
  fullName: "",
  password: false,
  latitude: null,
  longitude: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUserProfile: (state: AuthState, action: PayloadAction<IUserProfile>) => {
      state.id = action.payload.id;
      state.email = action.payload.email;
      state.is_active = action.payload.is_active;
      state.is_superuser = action.payload.is_superuser;
      state.fullName = action.payload.fullName;
      state.password = action.payload.password;
      state.latitude = action.payload.latitude ?? null;
      state.longitude = action.payload.longitude ?? null;
    },
    deleteAuth: () => {
      return initialState;
    },
  },
});

export const {
  setUserProfile,
  deleteAuth,
} = authSlice.actions;

export const profile = (state: RootState) => state.auth;
export const loggedIn = (state: RootState) => {
  const { auth, tokens: { refresh_token, token_type, access_token } = {} } =
    state;
  const loginInformation = [auth.id, refresh_token, token_type, access_token];
  const hasAllTokens = loginInformation.every((value) => value !== "");

  // Check if tokens exist and are not expired
  if (!hasAllTokens) return false;

  try {
    // Check if access token is expired
    if (access_token && tokenExpired(access_token)) {
      return false;
    }
    return true;
  } catch (error) {
    // If token parsing fails, consider it invalid
    return false;
  }
};
export const isAdmin = (state: RootState) => {
  return loggedIn(state) && state.auth.is_superuser && state.auth.is_active;
};

const handleGenericLogin =
  (
    loginAttempt: (payload: any) => any,
    payload: any,
    getProfile: boolean = true,
  ) =>
    async (
      dispatch: ThunkDispatch<any, void, Action>,
      getState: () => RootState,
    ) => {
      try {
        await dispatch(loginAttempt(payload));
        const token = getState().tokens.access_token;
        if (getProfile) {
          await dispatch(getUserProfile(token));
        }
      } catch (error) {
        dispatch(
          addNotice({
            title: "Login error",
            content:
              "Please check your details or internet connection and try again.",
            icon: "error",
          }),
        );
        dispatch(logout());
      }
    };

export const login = (payload: { username: string; password: string }) =>
  handleGenericLogin(getTokens, payload, true);

export const register = (payload: IUserOpenProfileCreate) => async (dispatch: any) => {
  console.log("[REGISTER] Starting registration with payload:", payload);
  try {
    const result = await apiAuth.createProfile(payload);
    console.log("[REGISTER] Profile created successfully:", result);

    // Auto-login after successful registration
    await dispatch(
      login({ username: payload.email, password: payload.password }),
    );
    console.log("[REGISTER] Auto-login dispatched");
  } catch (error: any) {
    console.error("[REGISTER] Registration failed:", error);

    const errorMessage = error?.message || error?.detail || "Registration failed. Please try again.";

    dispatch(
      addNotice({
        title: "Registration error",
        content: errorMessage,
        icon: "error",
      }),
    );
  }
};

export const logout = () => (dispatch: Dispatch) => {
  dispatch(deleteAuth());
  dispatch(deleteTokens());
  dispatch(deleteNotices());
  dispatch({
    type: PURGE,
    key: "root",
    result: () => null,
  });
};

export const getUserProfile =
  (token: string) => async (dispatch: ThunkDispatch<any, void, Action>) => {
    if (token) {
      try {
        const res = await apiAuth.getProfile(token);
        if (res.id) {
          dispatch(setUserProfile(res));
        } else throw "Error";
      } catch (error) {
        dispatch(
          addNotice({
            title: "Login error",
            content:
              "Please check your details, or internet connection, and try again.",
            icon: "error",
          }),
        );
        dispatch(logout());
      }
    }
  };

export const createUserProfile =
  (payload: IUserOpenProfileCreate) => async (dispatch: Dispatch) => {
    try {
      const res = await apiAuth.createProfile(payload);
      if (res.id) {
        dispatch(setUserProfile(res));
      } else throw "Error";
    } catch (error) {
      dispatch(
        addNotice({
          title: "Login creation error",
          content:
            "Please check your details, or internet connection, and try again.",
          icon: "error",
        }),
      );
    }
  };

export const updateUserProfile =
  (payload: IUserProfileUpdate) =>
    async (dispatch: Dispatch, getState: () => RootState) => {
      const currentState = getState();
      if (loggedIn(currentState) && currentState.tokens.access_token) {
        try {
          const res = await apiAuth.updateProfile(
            currentState.tokens.access_token,
            payload,
          );
          if (res.id) {
            dispatch(setUserProfile(res));
            dispatch(
              addNotice({
                title: "Profile update",
                content: "Your settings have been updated.",
              }),
            );
          } else throw "Error";
        } catch (error) {
          dispatch(
            addNotice({
              title: "Profile update error",
              content:
                "Please check your submission, or internet connection, and try again.",
              icon: "error",
            }),
          );
        }
      }
    };

export const enableTOTPAuthentication =
  (payload: IEnableTOTP) =>
    async (dispatch: Dispatch, getState: () => RootState) => {
      const currentState = getState();
      if (loggedIn(currentState) && currentState.tokens.access_token) {
        try {
          const res = await apiAuth.enableTOTPAuthentication(
            currentState.tokens.access_token,
            payload,
          );
          if (res.msg) {
            dispatch(setTOTPAuthentication(true));
            dispatch(
              addNotice({
                title: "Two-factor authentication",
                content: res.msg,
              }),
            );
          } else throw "Error";
        } catch (error) {
          dispatch(
            addNotice({
              title: "Error enabling two-factor authentication",
              content:
                "Please check your submission, or internet connection, and try again.",
              icon: "error",
            }),
          );
        }
      }
    };

export const disableTOTPAuthentication =
  (payload: IUserProfileUpdate) =>
    async (dispatch: Dispatch, getState: () => RootState) => {
      const currentState = getState();
      if (loggedIn(currentState) && currentState.tokens.access_token) {
        try {
          const res = await apiAuth.disableTOTPAuthentication(
            currentState.tokens.access_token,
            payload,
          );
          if (res.msg) {
            dispatch(setTOTPAuthentication(false));
            dispatch(
              addNotice({
                title: "Two-factor authentication",
                content: res.msg,
              }),
            );
          } else throw "Error";
        } catch (error) {
          dispatch(
            addNotice({
              title: "Error disabling two-factor authentication",
              content:
                "Please check your submission, or internet connection, and try again.",
              icon: "error",
            }),
          );
        }
      }
    };

export const sendEmailValidation =
  () => async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState();
    if (
      currentState.tokens.access_token &&
      !currentState.auth.email_validated
    ) {
      try {
        const res = await apiAuth.requestValidationEmail(
          currentState.tokens.access_token,
        );
        if (res.msg) {
          dispatch(
            addNotice({
              title: "Validation sent",
              content: res.msg,
            }),
          );
        } else throw "Error";
      } catch (error) {
        dispatch(
          addNotice({
            title: "Validation error",
            content: "Please check your email and try again.",
            icon: "error",
          }),
        );
      }
    }
  };

export const validateEmail =
  (validationToken: string) =>
    async (dispatch: Dispatch, getState: () => RootState) => {
      const currentState = getState();
      if (
        currentState.tokens.access_token &&
        !currentState.auth.email_validated
      ) {
        try {
          const res = await apiAuth.validateEmail(
            currentState.tokens.access_token,
            validationToken,
          );
          if (res.msg) {
            dispatch(setEmailValidation(true));
            dispatch(
              addNotice({
                title: "Success",
                content: res.msg,
              }),
            );
          } else throw "Error";
        } catch (error) {
          dispatch(
            addNotice({
              title: "Validation error",
              content: "Invalid token. Check your email and resend validation.",
              icon: "error",
            }),
          );
        }
      }
    };

export const recoverPassword =
  (email: string) => async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState();
    if (!loggedIn(currentState)) {
      try {
        const res = await apiAuth.recoverPassword(email);
        //@ts-ignore
        if (res?.msg || res?.claim) {
          if (res.hasOwnProperty("claim"))
            dispatch(setMagicToken(res as unknown as IWebToken));
          dispatch(
            addNotice({
              title: "Success",
              content:
                "If that login exists, we'll send you an email to reset your password.",
            }),
          );
        } else throw "Error";
      } catch (error) {
        dispatch(
          addNotice({
            title: "Login error",
            content:
              "Please check your details, or internet connection, and try again.",
            icon: "error",
          }),
        );
        dispatch(deleteTokens());
      }
    }
  };

export const resetPassword =
  (password: string, token: string) =>
    async (dispatch: Dispatch, getState: () => RootState) => {
      const currentState = getState();
      if (!loggedIn(currentState)) {
        try {
          const claim: string = currentState.tokens.access_token;
          // Check the two magic tokens meet basic criteria
          const localClaim = tokenParser(claim);
          const magicClaim = tokenParser(token);
          if (
            localClaim.hasOwnProperty("fingerprint") &&
            magicClaim.hasOwnProperty("fingerprint") &&
            localClaim["fingerprint"] === magicClaim["fingerprint"]
          ) {
            const res = await apiAuth.resetPassword(password, claim, token);
            if (res.msg) {
              dispatch(
                addNotice({
                  title: "Success",
                  content: res.msg,
                }),
              );
            } else throw "Error";
          }
        } catch (error) {
          dispatch(
            addNotice({
              title: "Login error",
              content:
                "Ensure you're using the same browser and that the token hasn't expired.",
              icon: "error",
            }),
          );
          dispatch(deleteTokens());
        }
      }
    };

export default authSlice.reducer;
