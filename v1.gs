const SHEET_NAME = "Users";

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

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = JSON.parse(e.postData.contents);
  const action = data.action; // Nouvelle propriété pour distinguer login/signup

  if (action === "signup") {
    return handleSignup(sheet, data);
  } else {
    return handleLogin(sheet, data);
  }


}

function handleSignup(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = data.email.toLowerCase();
  
  // Vérifier si l'utilisateur existe déjà
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === email) {
      return response({"result": "error", "message": "Cet email est déjà utilisé."});
    }
  }
  
  // Ajouter l'utilisateur dans la Sheet
  const hashedPassword = sha256(data.password);
  sheet.appendRow([email, hashedPassword, data.name, new Date()]);
  
  // ENVOI DE L'EMAIL DE BIENVENUE
  try {
    sendWelcomeEmail(email, data.name);
  } catch (e) {
    console.log("Erreur envoi email: " + e.toString());
    // On ne bloque pas l'inscription si l'email échoue
  }
  
  return response({"result": "success", "message": "Compte créé avec succès !"});
}

function sendWelcomeEmail(recipient, name) {
  const subject = "Bienvenue chez Gabonbelle - L'Excellence à Libreville";
  
  // Corps de l'email en HTML
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #d4af37; padding: 20px;">
      <h2 style="color: #d4af37; text-align: center;">GABONBELLE</h2>
      <p>Bonjour <strong>${name}</strong>,</p>
      <p>Nous sommes ravis de vous compter parmi nos clients privilégiés.</p>
      <p>Votre compte a été créé avec succès. Vous pouvez désormais accéder à votre tableau de bord pour gérer vos réservations :</p>
      <ul>
        <li>Bouquets Touristiques Libreville</li>
        <li>Expéditions de Chasse de Conservation</li>
        <li>Boutique de Prestige</li>
      </ul>
      <p style="margin-top: 30px;">À très bientôt pour une expérience unique au Gabon.</p>
      <hr style="border: 0; border-top: 1px solid #eee;">
      <p style="font-size: 0.8rem; color: #888; text-align: center;">
        © 2026 Gabonbelle - Prestige Urbain & Conservation
      </p>
    </div>
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });
}

function handleLogin(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = data.email.toLowerCase();
  const hashedPassword = sha256(data.password);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === email && rows[i][1].toString() === hashedPassword) {
      return response({"result": "success", "name": rows[i][2]});
    }
  }
  return response({"result": "error", "message": "Identifiants incorrects."});
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/**
 * Empêche l'erreur "Script function not found: doGet"
 * lors de l'accès direct à l'URL.
 */
function doGet(e) {
  return ContentService.createTextOutput("Le serveur Gabonbelle est opérationnel. Prêt pour les requêtes POST.")
    .setMimeType(ContentService.MimeType.TEXT);
}





