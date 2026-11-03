import { verifySigV1 } from "./sigv1.js";

export {
  addressSpendKey,
  addressMatchesNetwork,
  checkSignature,
  verifySigV1,
  base58Decode,
} from "./sigv1.js";

export interface SignatureVerifier {
  verify(input: {
    address: string;
    message: string;
    signature: string;
  }): boolean;
}

export const sigV1Verifier: SignatureVerifier = { verify: verifySigV1 };
