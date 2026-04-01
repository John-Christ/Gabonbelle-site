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

function doGet(e) {
  return ContentService.createTextOutput("Le serveur Gabonbelle est opérationnel.")
    .setMimeType(ContentService.MimeType.TEXT);
}



function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Vérification de sécurité pour éviter le crash si e.postData est vide
  if (!e.postData || !e.postData.contents) return response({"result":"error", "message":"No data"});
  
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const sheetUsers = ss.getSheetByName(Users);

  if (action === "signup") { 
    return handleSignup(sheetUsers, data); 
  } else if (action === "login") { 
    return handleLogin(sheetUsers, data); 
  } else if (action === "forgot") { 
    return handleForgot(sheetUsers, data); // <--- Vérifiez que cette ligne existe
  } else if (action === "resetPassword") { 
    return handleResetPassword(sheetUsers, data); // <--- Et celle-ci
  } else if (action === "getOrders") { 
    return handleGetOrders(ss.getSheetByName(SHEET_ORDERS), data.email); 
  }
  
  // Réponse par défaut si aucune action ne correspond
  return response({"result": "error", "message": "Action " + action + " non reconnue"});
}



/**
 * Gère toutes les actions du site
 
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
  else if (action === "updateStatus") {
    return handleUpdateStatus(ss.getSheetByName(SHEET_ORDERS), data);
  }


// --- MODIFIEZ CETTE PARTIE DANS VOTRE doPost(e) ---
  else if (action === "forgot") {
    return handleForgot(ss.getSheetByName(SHEET_USERS), data);
  }
  else if (action === "resetPassword") {
    return handleResetPassword(ss.getSheetByName(SHEET_USERS), data);
  }
 // Fin de la fonction doPost
 return response({"result": "error", "message": "Action non reconnue"});

}
*/








/**
 * INSCRIPTION FIXÉE
 */
function handleSignup(sheet, data) {
  // 1. Vérification si la feuille existe
  if (!sheet) {
    return response({"result": "error", "message": "Erreur interne : Feuille 'Users' introuvable."});
  }

  const rows = sheet.getDataRange().getValues();
  const email = data.email.trim().toLowerCase(); // Ajout de .trim() pour éviter les espaces invisibles
  
  // 2. Vérifier si l'utilisateur existe déjà
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().toLowerCase() === email) {
      return response({"result": "error", "message": "Cet email est déjà utilisé."});
    }
  }
  
  // 3. Hachage et Enregistrement
  try {
    const hashedPassword = sha256(data.password);
    sheet.appendRow([email, hashedPassword, data.name, new Date()]);
    
    // 4. Email (Optionnel - si ça bloque, le compte est quand même créé)
    try { 
      sendWelcomeEmail(email, data.name); 
    } catch (mailError) { 
      console.log("Email non envoyé: " + mailError); 
    }
    
    return response({"result": "success", "message": "Compte créé avec succès !"});
    
  } catch (err) {
    return response({"result": "error", "message": "Erreur lors de l'enregistrement : " + err.toString()});
  }
}



/**
 * INSCRIPTION
 *
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
} */

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
 * Colonnes attendues dans 'Commandes' : 
 * A:Email | B:Service | C:Prix | D:Statut | E:Date | F:PaypalLink
 */
function handleAddOrder(sheet, data) {
  sheet.appendRow([data.email, data.service, data.price, "En attente", new Date(), data.paypalLink || ""]);
  return response({"result": "success", "message": "Ajouté au panier"});
}



/**
 * RÉCUPÉRER LES COMMANDES (Version : Plus récent en haut)
 */
function handleGetOrders(sheet, email) {
  const rows = sheet.getDataRange().getValues();
  const userOrders = [];
  const targetEmail = email.toLowerCase();

  // On commence par la fin (rows.length - 1) et on remonte jusqu'à la ligne 1
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0].toString().toLowerCase() === targetEmail) {
      userOrders.push({
        id: "GB-" + (i + 1), 
        service: rows[i][1],
        price: rows[i][2],
        status: rows[i][3],
        date: Utilities.formatDate(new Date(rows[i][4]), "GMT+1", "dd/MM/yyyy"),
        paypalLink: rows[i][5] || "" 
      });
    }
  }
  return response({"result": "success", "orders": userOrders});
}



/**
 * RÉCUPÉRER LES COMMANDES
 
function handleGetOrders(sheet, email) {
  const rows = sheet.getDataRange().getValues();
  const userOrders = [];
  const targetEmail = email.toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase() === targetEmail) {
      userOrders.push({
        id: "GB-" + (i + 1), // ID basé sur le numéro de ligne réelle pour updateStatus
        service: rows[i][1],
        price: rows[i][2],
        status: rows[i][3],
        date: Utilities.formatDate(new Date(rows[i][4]), "GMT+1", "dd/MM/yyyy"),
        paypalLink: rows[i][5] || "" // Récupère le lien en colonne F
      });
    }
  }
  return response({"result": "success", "orders": userOrders});
}

*/
/**
 * METTRE À JOUR LE STATUT (Après clic sur Payer)
 */
function handleUpdateStatus(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  // L'ID envoyé est "GB-X", on extrait X pour avoir le numéro de ligne
  const rowIndex = parseInt(data.orderId.replace("GB-", ""));
  
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 4).setValue(data.newStatus); // Colonne D (Statut)
    return response({"result": "success"});
  }
  return response({"result": "error", "message": "Ligne non trouvée"});
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





/**
 * GÉNÉRATION DU CODE DE RÉCUPÉRATION (ÉTAPE 1)
 */
function handleForgot(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = data.email.trim().toLowerCase();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().toLowerCase() === email) {
      // Générer un code à 6 chiffres
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Enregistrer en Colonne E (index 5 dans getRange car c'est la 5ème colonne)
      sheet.getRange(i + 1, 5).setValue(code);

      // Envoi de l'email
      const subject = "🔑 Code de sécurité Gabonbelle";
      const htmlBody = `<div style="font-family: Arial; border: 1px solid #d4af37; padding: 20px; text-align:center;">
        <h2 style="color: #d4af37;">GABONBELLE PRESTIGE</h2>
        <p>Votre code de réinitialisation est :</p>
        <h1 style="letter-spacing:5px; color:#d4af37;">${code}</h1>
        <p style="font-size:12px; color:#888;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      </div>`;
      
      try {
        MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
        return response({"result": "success", "message": "Code de sécurité envoyé par e-mail."});
      } catch (e) {
        return response({"result": "error", "message": "Erreur d'envoi d'email."});
      }
    }
  }
  return response({"result": "error", "message": "Aucun compte trouvé avec cet email."});
}

/**
 * MISE À JOUR DU MOT DE PASSE HACHÉ (ÉTAPE 2)
 */
function handleResetPassword(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = data.email.trim().toLowerCase();
  const codeRecu = data.code.toString().trim();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().toLowerCase() === email) {
      const codeStocke = rows[i][4].toString(); // Colonne E

      if (codeRecu === codeStocke && codeRecu !== "") {
        // Hacher le nouveau mot de passe avant de l'enregistrer
        const newHashedPassword = sha256(data.newPass);
        
        sheet.getRange(i + 1, 2).setValue(newHashedPassword); // Colonne B (index 2)
        sheet.getRange(i + 1, 5).setValue(""); // Effacer le code utilisé
        
        return response({"result": "success", "message": "Mot de passe mis à jour avec succès !"});
      } else {
        return response({"result": "error", "message": "Code de sécurité incorrect."});
      }
    }
  }
  return response({"result": "error", "message": "Une erreur est survenue."});
}
