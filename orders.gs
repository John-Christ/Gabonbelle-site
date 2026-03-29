const SHEET_USERS = "Users";
const SHEET_ORDERS = "Commandes";

/**
 * Sécurité : Hachage des mots de passe
 */
function sha256(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

/**
 * Gère les requêtes GET (Validation serveur)
 */
function doGet(e) {
  return ContentService.createTextOutput("Le serveur Gabonbelle est opérationnel.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Gère toutes les actions du site (Login, Signup, AddOrder, GetOrders)
 */
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  if (action === "signup") {
    return handleSignup(ss.getSheetByName(SHEET_USERS), data);
  } 
  else if (action === "login") {
    return handleLogin(ss.getSheetByName(SHEET_USERS), data);
  } 
  else if (action === "addOrder") {
    return handleAddOrder(ss.getSheetByName(SHEET_ORDERS), data);
  } 
  else if (action === "getOrders") {
    return handleGetOrders(ss.getSheetByName(SHEET_ORDERS), data.email);
  }
}

/**
 * INSCRIPTION
 */
function handleSignup(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = data.email.toLowerCase();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === email) {
      return response({"result": "error", "message": "Cet email est déjà utilisé."});
    }
  }
  
  const hashedPassword = sha256(data.password);
  sheet.appendRow([email, hashedPassword, data.name, new Date()]);
  
  try { sendWelcomeEmail(email, data.name); } catch (e) { console.log(e); }
  
  return response({"result": "success", "message": "Compte créé avec succès !"});
}

/**
 * CONNEXION
 */
function handleLogin(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = data.email.toLowerCase();
  const hashedPassword = sha256(data.password);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === email && rows[i][1].toString() === hashedPassword) {
      return response({"result": "success", "name": rows[i][2], "email": email});
    }
  }
  return response({"result": "error", "message": "Identifiants incorrects."});
}

/**
 * AJOUTER AU PANIER
 */
function handleAddOrder(sheet, data) {
  // Colonnes : Email | Service | Prix | Statut | Date
  sheet.appendRow([data.email, data.service, data.price, "En attente", new Date()]);
  return response({"result": "success", "message": "Ajouté au panier"});
}

/**
 * RÉCUPÉRER LES COMMANDES D'UN UTILISATEUR
 */
function handleGetOrders(sheet, email) {
  const rows = sheet.getDataRange().getValues();
  const userOrders = [];
  const targetEmail = email.toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === targetEmail) {
      userOrders.push({
        id: "GB-" + i, // ID généré basé sur la ligne
        service: rows[i][1],
        price: rows[i][2],
        status: rows[i][3],
        date: Utilities.formatDate(new Date(rows[i][4]), "GMT+1", "dd/MM/yyyy")
      });
    }
  }
  return response({"result": "success", "orders": userOrders});
}

/**
 * EMAIL DE BIENVENUE
 */
function sendWelcomeEmail(recipient, name) {
  const subject = "Bienvenue chez Gabonbelle - L'Excellence à Libreville";
  const htmlBody = `<div style="font-family: Arial; border: 1px solid #d4af37; padding: 20px;">
    <h2 style="color: #d4af37;">GABONBELLE</h2>
    <p>Bonjour <strong>${name}</strong>, votre compte est prêt.</p>
    <p>À très bientôt pour une expérience unique au Gabon.</p>
  </div>`;

  MailApp.sendEmail({ to: recipient, subject: subject, htmlBody: htmlBody });
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
