// =================================================================
// CONFIGURATION FILE
// =================================================================
// Purpose: Store all environment-specific variables here.
// This is the ONLY file you should need to edit when deploying.
// -----------------------------------------------------------------

    // config.js
const config = {
    // The base URL for your function app.
    // Does NOT include /api/FunctionName
    API_BASE_URL: "https://func-receipt-tracker-b8gxcue7bxhgc5bq.westus3-01.azurewebsites.net",

    // The function keys for each of your endpoints.
    // Get these from the "Get function URL" button in the Azure Portal for each function.
    PROCESS_RECEIPT_KEY: "https://func-receipt-tracker-b8gxcue7bxhgc5bq.westus3-01.azurewebsites.net/api/ProcessReceipt",
    GET_RECEIPTS_KEY: "https://func-receipt-tracker-b8gxcue7bxhgc5bq.westus3-01.azurewebsites.net/api/GetReceipts",
    DELETE_SINGLE_KEY: "https://func-receipt-tracker-b8gxcue7bxhgc5bq.westus3-01.azurewebsites.net/api/DeleteReceipt/18a0cf8c-8292-4d5c-9e58-b6745015651f",
    DELETE_MULTIPLE_KEY: "https://func-receipt-tracker-b8gxcue7bxhgc5bq.westus3-01.azurewebsites.net/api/DeleteMultipleReceipts"
};