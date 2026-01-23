import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";

/* ---------------- TYPES ---------------- */

export type UserRole =
  | "user"
  | "super_admin"
  | "manager"
  | "customer_support"
  | "blog_manager";

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
};

/* ---------------- THUNK ---------------- */

export const fetchUserProfile = createAsyncThunk<UserProfile | null, string>(
  "user/fetchProfile",
  async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
      return null;
    }

    return data as UserProfile;
  }
);

/* ---------------- SLICE ---------------- */

type UserState = {
  profile: UserProfile | null;
  loading: boolean;
};

const initialState: UserState = {
  profile: null,
  loading: true,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearProfile(state) {
      state.profile = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.loading = false;
      })
      .addCase(fetchUserProfile.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { clearProfile } = userSlice.actions;
export default userSlice.reducer;
