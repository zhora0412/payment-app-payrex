export interface ActionData {
  instance_key: string;
  api_key: string;
  activeStatus: boolean;
  designs: Design[];
  designsData: {
    designs: Design[];
  };
  current_design:{
    name: string;
  }
}

export interface TransactionShop {
  name: string;
  access_token: string;
}

export type Design = {
  uuid: string;
  default: boolean;
  name: string;
}
export interface Localization {
  EN: {};
  DE: {};
  FR: {};
}
export type Language = keyof Localization;

export interface QueryParams {
  lookAndFeelProfile?: string | null;
  currency: string;
  amount: number;
  cancelRedirectUrl?: any;
  successRedirectUrl?: string;
  failedRedirectUrl?: string;
  ApiSignature?: string;
}
export interface ShopData {
  shopData: {
    name: string;
    instance_key?: string;
    api_key?: string;
    platform_key?: string;
    design_key?: string;
    design_name?: string;
    language?: Language;
  },
  loader_designsData: {
    designs: Design[];
  },
  loader_design_current: {
    uuid: string;
    name: string;
  }
}
