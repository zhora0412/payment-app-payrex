import cryptoJS from "crypto-js";

export function buildBaseUrl(key: string, shopifyMode?: boolean){
  key = key === 'auth' ? 'payrexx' : key;
  const baseUrl = process.env.DEV_MODE === 'true' || shopifyMode ? `https://api.stage.payrexx.com/v1.0/` : `https://api.${key}.com/v1.0/`;
  return baseUrl;
}

export function buildUrl(
    baseURL: string,
    endpoint: string,
    instance_key: string,
    api_key: string,
    query = ''
) {
    const apiSignature = cryptoJS.enc.Base64.stringify(cryptoJS.HmacSHA256(query, api_key))
    return `${baseURL + endpoint}?instance=${instance_key}&ApiSignature=${apiSignature}`;
}

export function buildSignature(
    api_key: string,
    query = ''
) {
    return cryptoJS.enc.Base64.stringify(cryptoJS.HmacSHA256(query, api_key))
}
