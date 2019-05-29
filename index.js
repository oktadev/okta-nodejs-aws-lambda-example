const express = require('express');

const absPathPrefix = process.env.ABSOLUTE_PATH_PREFIX || '';

const app = express();

const port = process.env.PORT || 8080;

app.get('/where-is-it', require('./where-is-it'));
app.use('/', (req, res) => res.redirect(`${absPathPrefix}/where-is-it`));

if (process.env.LAMBDA_TASK_ROOT) {
  const serverlessExpress = require('aws-serverless-express');
  const server = serverlessExpress.createServer(app);
  exports.handler = (event, context) => serverlessExpress.proxy(server, event, context);
} else {
  app.listen(port, () => console.log(`Listening on port ${port}`));
}
