import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";

/* ---------------- TYPES ---------------- */

export type BillType =
  | "airtime"
  | "data"
  | "cable"
  | "electricity"
  | "education"
  | "international-airtime"
  | "showmax";

export type DataPlan = {
  id: string;                 // unique id for UI selection
  name: string;               // display text
  amount: number;             // numeric amount in NGN
  plan_code?: string;         // vtpass/clubkonnect code
  variation_code?: string;    // alt code (some providers use this)
  validity?: string;          // optional
  data_size?: string;  
  serviceID: string;       // optional
  ck_plan_code?: string;
};

type BillState = {
  selectedBill: BillType | null;

  // Common
  amount: string;
  selectedPlan: string;
  phoneNumber: string,
  showPaymentModal: boolean,
  

  // Airtime / Data
  networkProvider: string;

  // Cable
  cableProvider: string;
  smartcardNumber: string;
  isSmartcardValidated: boolean;

  // Electricity
  electricityProvider: string;
  meterType: "prepaid" | "postpaid" | "";
  meterNumber: string;
  isMeterValidated: boolean;

  // Education
  educationService: string;
  educationPackage: string;

  // International airtime
  selectedCountry: string;
  selectedProductType: string;
  selectedOperator: string;
  selectedIntlServiceID: string;
  selectedIntlServiceName: string;

  // Async data plans
  dataPlans: DataPlan[];
  dataPlansLoading: boolean;
  dataPlansError: string | null;

  // UI flags
  isSubmitting: boolean;
};

/* ---------------- INITIAL STATE ---------------- */

const initialState: BillState = {
  selectedBill: null,

  amount: "",
  selectedPlan: "",
  phoneNumber: "",
  showPaymentModal: false,

  networkProvider: "",

  cableProvider: "",
  smartcardNumber: "",
  isSmartcardValidated: false,

  electricityProvider: "",
  meterType: "",
  meterNumber: "",
  isMeterValidated: false,

  educationService: "",
  educationPackage: "",

  selectedCountry: "",
  selectedProductType: "",
  selectedOperator: "",
  selectedIntlServiceID: "",
  selectedIntlServiceName: "",

  dataPlans: [],
  dataPlansLoading: false,
  dataPlansError: null,

  isSubmitting: false,
};

/* ---------------- ASYNC THUNK ---------------- */

/**
 * This now calls YOUR API (per selected network).
 * You will create the API route to return plans.
 */
export const fetchDataPlans = createAsyncThunk<
  DataPlan[],
  string,
  { rejectValue: string }
>("bill/fetchDataPlans", async (network, { rejectWithValue }) => {
  try {
    if (!network) throw new Error("Network not selected");

   const res = await fetch(
  `/api/bills/data-plans?network=${encodeURIComponent(network)}`,
  { cache: "no-store" }
);

    const raw = await res.text();
    let out: any = null;
    try {
      out = JSON.parse(raw);
    } catch {
      throw new Error(raw || "Invalid server response");
    }

    if (!res.ok) throw new Error(out?.error || "Failed to fetch data plans");

    // Expect: { plans: DataPlan[] }
    return (out?.plans || []) as DataPlan[];
  } catch (err: any) {
    return rejectWithValue(err.message || "Failed to load data plans");
  }
});

/* ---------------- SLICE ---------------- */

const billSlice = createSlice({
  name: "bill",
  initialState,
  reducers: {
    selectBillType(state, action: PayloadAction<BillType>) {
      return {
        ...initialState,
        selectedBill: action.payload,
      };
    },
    setPhoneNumber: (state, action) => {
      state.phoneNumber = action.payload;
    },

    setShowPaymentModal: (state, action) => {
      state.showPaymentModal = action.payload;
    },

    setAmount(state, action: PayloadAction<string>) {
      state.amount = action.payload;
    },

    setSelectedPlan(state, action: PayloadAction<string>) {
      state.selectedPlan = action.payload;
    },

    setNetworkProvider(state, action: PayloadAction<string>) {
      state.networkProvider = action.payload;
      state.selectedPlan = "";
      state.amount = "";
      state.dataPlans = [];
      state.dataPlansError = null;
    },

    setCableProvider(state, action: PayloadAction<string>) {
      state.cableProvider = action.payload;
      state.isSmartcardValidated = false;
    },

    validateSmartcard(state) {
      state.isSmartcardValidated = true;
    },

    setElectricityProvider(state, action: PayloadAction<string>) {
      state.electricityProvider = action.payload;
      state.isMeterValidated = false;
    },

    setMeterType(state, action: PayloadAction<"prepaid" | "postpaid">) {
      state.meterType = action.payload;
      state.isMeterValidated = false;
    },

    setMeterNumber(state, action: PayloadAction<string>) {
      state.meterNumber = action.payload;
    },

    validateMeter(state) {
      state.isMeterValidated = true;
    },

    setEducationService(state, action: PayloadAction<string>) {
      state.educationService = action.payload;
    },

    setEducationPackage: (state, action) => {
      state.educationPackage = action.payload; // variation_code
    },

    setIntlCountry(state, action: PayloadAction<string>) {
      state.selectedCountry = action.payload;

      state.selectedProductType = "";
      state.selectedIntlServiceID = "";
      state.selectedIntlServiceName = "";

      state.selectedOperator = "";
      state.selectedPlan = "";
      state.amount = "";
    },

    setIntlProductType(state, action: PayloadAction<string>) {
      state.selectedProductType = action.payload;
      state.selectedOperator = "";
      state.selectedPlan = "";
    },

    setIntlOperator(state, action: PayloadAction<string>) {
      state.selectedOperator = action.payload;
      state.selectedPlan = "";
    },

    setSubmitting(state, action: PayloadAction<boolean>) {
      state.isSubmitting = action.payload;
    },

    setIntlService(state, action) {
      state.selectedProductType = action.payload.id;
      state.selectedIntlServiceName = action.payload.name;

      const n = String(action.payload.name || "").trim().toLowerCase();

      // exact mapping based on your real names
      if (n === "mobile data") state.selectedIntlServiceID = "foreign-data";
      else if (n === "mobile top up") state.selectedIntlServiceID = "foreign-airtime";
      else if (n === "mobile pin / voucher") state.selectedIntlServiceID = "foreign-pin";
      else state.selectedIntlServiceID = "foreign-airtime";

      // reset downstream
      state.selectedOperator = "";
      state.selectedPlan = "";
      state.amount = "";
    },

    resetBill() {
      return initialState;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchDataPlans.pending, (state) => {
        state.dataPlansLoading = true;
        state.dataPlansError = null;
      })
      .addCase(fetchDataPlans.fulfilled, (state, action) => {
        state.dataPlansLoading = false;
        state.dataPlans = action.payload;
      })
      .addCase(fetchDataPlans.rejected, (state, action) => {
        state.dataPlansLoading = false;
        state.dataPlansError = action.payload || "Failed to load data plans";
      });
  },
});

export const {
  selectBillType,
  setAmount,
  setSelectedPlan,
  setNetworkProvider,
  setCableProvider,
  validateSmartcard,
  setElectricityProvider,
  setMeterType,
  setMeterNumber,
  validateMeter,
  setEducationService,
  setEducationPackage,
  setIntlCountry,
  setIntlService,
  setIntlProductType,
  setIntlOperator,
  setSubmitting,
  resetBill,
  setPhoneNumber,
  setShowPaymentModal,
} = billSlice.actions;

export default billSlice.reducer;
