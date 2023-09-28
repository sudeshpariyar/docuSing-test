const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const docusign = require("docusign-esign");
const fs = require("fs");
const session = require("express-session");

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "thisisthesecret",
    resave: true,
    saveUninitialized: true,
  })
);
app.post("/form", async (req, res) => {
  await checkToken(req);
  let envelopesApi = getEnvelopesApi(req);
  let envelope = makeEnvelope(req.body.name, req.body.email, req.body.company);

  let results = await envelopesApi.createEnvelope(process.env.ACCOUNT_ID, {
    envelopeDefinition: envelope,
  });

  console.log("THis is results", results);

  //   console.log(req.body);
  res.send("received");
});
function getEnvelopesApi(req) {
  let dsApiClient = new docusign.ApiClient();
  dsApiClient.setBasePath(process.env.BASE_PATH);
  dsApiClient.addDefaultHeader(
    "Authorization",
    "Bearer " + req.session.access_token
  );
  return new docusign.EnvelopesApi(dsApiClient);
}

function makeEnvelope(name, email, company) {
  // Create the envelope definition
  let env = new docusign.EnvelopeDefinition();
  env.templateId = process.env.TEMPLATE_ID;

  let signer1 = docusign.TemplateRole.constructFromObject({
    email: email,
    name: name,
    company: company,

    roleName: "applicant",
  });

  env.templateRoles = [signer1];
  env.status = "sent";
  return env;
}

//utill

async function checkToken(req) {
  if (req.session.access_token && Date.now() < req.session.expires_at) {
    console.log("re-using access token", req.session.access_token);
  } else {
    console.log("new access token");
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(process.env.BASE_PATH);
    const results = await dsApiClient.requestJWTUserToken(
      process.env.INTRIGATION_KEY,
      process.env.USER_ID,
      (scopes = "signature"),
      fs.readFileSync(path.join(__dirname, "private.key")),
      (expiresIn = 3600)
    );
    console.log("results", results.body);
    req.session.access_token = results.body.access_token;
    req.session.expires_at = Date.now() + (results.body.expires_in - 60) * 1000;
  }
}

app.get("/", async (req, res) => {
  await checkToken(req);
  res.sendFile(path.join(__dirname, "main.html"));
});

app.listen((port = 8000), () => {
  console.log("listening on port");
});

//https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=1b84dbfe-7205-45bd-8a44-1e749c947080&redirect_uri=http://localhost:8000/
