require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { ExpressOIDC } = require('@okta/oidc-middleware');

const absPathPrefix = process.env.ABSOLUTE_PATH_PREFIX || '';

const app = express();

app.use(session({
  secret: process.env.APP_SECRET,
  resave: true,
  saveUninitialized: false,
}));

const oidc = new ExpressOIDC({
  issuer: `${process.env.OKTA_ORG_URL}/oauth2/default`,
  client_id: process.env.OKTA_CLIENT_ID,
  client_secret: process.env.OKTA_CLIENT_SECRET,
  appBaseUrl: process.env.HOST_URL,
  scope: 'openid profile',
  loginRedirectUri: `${process.env.HOST_URL}${absPathPrefix}/authorization-code/callback`,
  routes: {
    loginCallback: {
      afterCallback: `${absPathPrefix}/where-is-it`
    },
  },
});

const ensureAuthenticated = oidc.ensureAuthenticated(`${absPathPrefix}/login`);

app.use(oidc.router);

const port = process.env.PORT || 8080;

app.get('/where-is-it', ensureAuthenticated, require('./where-is-it'));
app.use('/', (req, res) => res.redirect(`${absPathPrefix}/where-is-it`));

if (process.env.LAMBDA_TASK_ROOT) {
  const serverlessExpress = require('aws-serverless-express');
  const server = serverlessExpress.createServer(app);
  exports.handler = (event, context) => serverlessExpress.proxy(server, event, context);
} else {
  app.listen(port, () => console.log(`Listening on port ${port}`));
}
