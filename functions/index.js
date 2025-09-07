/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
// const {onRequest} = require("firebase-functions/https");
// const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
// functions/index.js

const functions = require("firebase-functions");
// const admin = require("firebase-admin");
const axios = require("axios");

// A inicialização do admin já deve estar no seu arquivo
// admin.initializeApp();

// Pega a chave de API que salvamos na configuração
const apiKey = process.env.EXCHANGERATE_KEY;

/**
 * Cloud Function "chamável" que converte um valor de uma moeda para EUR.
 */
exports.converterParaEUR = functions.https.onCall(async (data, context) => {
  const {valor, moedaOrigem} = data;

  // Validação básica dos dados recebidos
  if (!valor || !moedaOrigem || typeof valor !== "number" || typeof moedaOrigem !== "string") {
    throw new functions.https.HttpsError("invalid-argument",
        "Dados inválidos. Forneça \"valor\" (número) e " +
    "\"moedaOrigem\" (string).");
  }

  if (moedaOrigem.toUpperCase() === "EUR") {
    return {valorConvertido: valor};
  }

  const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${moedaOrigem.toUpperCase()}`;

  try {
    const response = await axios.get(apiUrl);
    const rates = response.data.conversion_rates;

    if (!rates || !rates.EUR) {
      throw new functions.https.HttpsError("not-found",
          `Não foi possível encontrar a taxa de conversão para EUR a partir de ${moedaOrigem}.`);
    }

    const taxaConversao = rates.EUR;
    const valorConvertido = valor * taxaConversao;

    console.log(`Convertido ${valor} ${moedaOrigem} para ${valorConvertido.toFixed(4)} EUR com taxa de ${taxaConversao}`);

    // Retorna o valor convertido para o frontend
    return {valorConvertido: parseFloat(valorConvertido.toFixed(4))};
  } catch (error) {
    console.error("Erro na API de conversão de moeda:", error.response ? error.response.data : error.message);
    throw new functions.https.HttpsError("internal", "Falha ao buscar taxa de câmbio.");
  }
});

