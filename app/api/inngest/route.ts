import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import { sendBuyOrderPinEmail, sendLowerAlertEmail, sendSellOrderPinEmail, sendSignUpEmail, sendUpperAlertEmail, updateClosingPrices } from "@/lib/inngest/function";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendUpperAlertEmail, sendLowerAlertEmail, sendBuyOrderPinEmail, sendSellOrderPinEmail, updateClosingPrices],
})