// --- CONFIGURATION GLOBALE ---
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const data = request.data;
    let result;

    switch (action) {
      case 'authenticate':
        result = authenticateUser(data.email, data.pass);
        break;
      case 'register':
        result = registerUser(data.name, data.email, data.phone, data.pass);
        break;
      case 'updateProfile':
        result = updateProfile(data.email, data.name, data.phone);
        break;
      case 'getAllProperties':
        result = getAllProperties();
        break;
      case 'submitPost':
        result = submitPost(data);
        break;
      case 'requestUpgrade':
        result = requestUpgrade(data);
        break;
      case 'getUserStats':
        result = getUserStats(data.email);
        break;
      case 'getUserAds':
        result = getUserAds(data.email);
        break;
      case 'saveInterest':
        result = saveInterest(data);
        break;
      default:
        throw new Error("Action non reconnue");
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- GESTION DES UTILISATEURS ---
function authenticateUser(email, pass) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('users');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === email.toLowerCase().trim() && rows[i][3].toString() === pass.toString()) {
      return { email: rows[i][0], name: rows[i][1], phone: rows[i][2], status: rows[i][4] || "Off" };
    }
  }
  return null;
}

function registerUser(name, email, phone, pass) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('users');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === email.toLowerCase().trim()) {
      throw new Error("Cet email est déjà utilisé.");
    }
  }
  sheet.appendRow([email, name, phone, pass, "Off"]);
  return { email, name, phone, status: "Off" };
}

function updateProfile(email, name, phone) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('users');
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === email.toLowerCase().trim()) {
      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 3).setValue(phone);
      
      let userStatus = rows[i][4] || "Off";
      return { email, name, phone, status: userStatus };
    }
  }
  throw new Error("Utilisateur introuvable");
}

// --- CATALOGUE AVEC DYNAMISME USER STATUS ---
function getAllProperties() {
  const propSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('properties');
  const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('users');
  
  if (!propSheet) return [];
  
  // Construire une carte des statuts à jour de chaque utilisateur
  const userMap = {};
  if (userSheet) {
    const userRows = userSheet.getDataRange().getValues();
    for (let j = 1; j < userRows.length; j++) {
      userMap[userRows[j][0].toString().toLowerCase().trim()] = userRows[j][4] || "Off";
    }
  }

  const rows = propSheet.getDataRange().getValues();
  const properties = [];
  
  for (let i = 1; i < rows.length; i++) {
    let ownerEmailClean = rows[i][1].toString().toLowerCase().trim();
    // Le statut est hérité en temps réel de l'onglet 'users' si disponible
    let realOwnerStatus = userMap[ownerEmailClean] || rows[i][4] || "Off";

    properties.push({
      id: rows[i][0], 
      ownerEmail: rows[i][1], 
      ownerName: rows[i][2], 
      ownerPhone: rows[i][3],
      ownerStatus: realOwnerStatus, 
      type: rows[i][5], 
      cat: rows[i][6], 
      ville: rows[i][7],
      title: rows[i][8], 
      price: rows[i][9], 
      img: rows[i][10], 
      isBoosted: rows[i][11],
      isPremium: rows[i][12], 
      date: rows[i][13]
    });
  }
  return properties;
}

// --- PUBLICATION CORRIGÉE (NOUVEAU FORMAT DE LIEN DRIVE INCONTOURNABLE) ---
function submitPost(data) {
  const propSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('properties');
  const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('users');
  
  let ownerStatus = "Off";
  if (userSheet) {
    const userRows = userSheet.getDataRange().getValues();
    for (let i = 1; i < userRows.length; i++) {
      if (userRows[i][0].toString().toLowerCase().trim() === data.ownerEmail.toLowerCase().trim()) {
        ownerStatus = userRows[i][4] || "Off";
        break;
      }
    }
  }

  let imageUrls = [];
  if (data.images && data.images.length > 0) {
    const folder = getOrCreateImagesFolder();
    data.images.forEach((base64Data, index) => {
      try {
        if (base64Data && base64Data.includes(",")) {
          const contentType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";"));
          const base64Clean = base64Data.substring(base64Data.indexOf(",") + 1);
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Clean), contentType, "immo_" + Date.now() + "_" + index);
          const file = folder.createFile(blob);
          
          // Force l'accès public en lecture seule
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // 🔥 CORRECTION ICI : Utilisation de lh3.googleusercontent.com pour contourner les restrictions d'affichage
          const directUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
          imageUrls.push(directUrl);
        }
      } catch (err) {
        // En cas d'erreur sur une image, on ignore pour ne pas rompre la publication
      }
    });
  }
  
  const finalImageString = imageUrls.length > 0 ? imageUrls.join(",") : "https://via.placeholder.com/400x300";
  const propId = "PROP_" + Date.now();
  
  propSheet.appendRow([
    propId, 
    data.ownerEmail, 
    data.ownerName, 
    data.ownerPhone || "", 
    ownerStatus,
    data.type, 
    data.cat, 
    data.ville, 
    data.title, 
    data.price, 
    finalImageString,
    data.isPremium ? "On" : "Off", 
    data.isPremium ? "true" : "false", 
    data.date
  ]);

  if (data.isPremium && data.airtelTransactionId) {
    const paySheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('payments');
    if (paySheet) {
      paySheet.appendRow([
        new Date().toLocaleString('fr-FR'), data.ownerEmail, "Blue_Via_Post",
        data.airtelPhone || "", data.airtelTransactionId, "En attente"
      ]);
    }
  }
  return { id: propId };
}

function requestUpgrade(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('payments');
  sheet.appendRow([new Date().toLocaleString('fr-FR'), data.email, data.upgradeType, data.airtelPhone, data.airtelTransactionId, "En attente"]);
  return true;
}

function getUserStats(email) {
  const propSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('properties');
  const interestSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('interests');
  let userPropertiesIds = [];
  let totalPropertiesCount = 0;
  
  if (propSheet) {
    const propRows = propSheet.getDataRange().getValues();
    for (let i = 1; i < propRows.length; i++) {
      if (propRows[i][1].toString().toLowerCase().trim() === email.toLowerCase().trim()) {
        userPropertiesIds.push(propRows[i][0].toString());
        totalPropertiesCount++;
      }
    }
  }
  let viewsCalculated = totalPropertiesCount * 42; 
  let leadsCount = 0;
  if (interestSheet && userPropertiesIds.length > 0) {
    const intRows = interestSheet.getDataRange().getValues();
    for (let j = 1; j < intRows.length; j++) {
      if (userPropertiesIds.indexOf(intRows[j][1].toString()) !== -1) leadsCount++;
    }
  }
  return { views: viewsCalculated, leads: leadsCount, commissions: (leadsCount * 5000) };
}

function getUserAds(email) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('properties');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const ads = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase().trim() === email.toLowerCase().trim()) {
      ads.push({ title: rows[i][8], price: rows[i][9] });
    }
  }
  return ads;
}

function saveInterest(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('interests');
  sheet.appendRow([data.timestamp, data.propId, data.propTitle, data.name, data.tel, data.email]);
  return true;
}

function getOrCreateImagesFolder() {
  const folderName = "Gabonbelle_Immo_Images";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  const folder = DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}
