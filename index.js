const express = require('express');
const topojson = require('topojson-client');
const pointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');
const fetch = require('node-fetch');

const absPathPrefix = process.env.ABSOLUTE_PATH_PREFIX || '';

const app = express();

const port = process.env.PORT || 8080;

const getCountries = () => fetch('https://raw.githubusercontent.com/johan/world.geo.json/34c96bba9c07d2ceb30696c599bb51a5b939b20f/countries.geo.json')
  .then(response => response.json());

const getUSZipCodes = () => fetch('https://gist.githubusercontent.com/jefffriesen/6892860/raw/e1f82336dde8de0539a7bac7b8bc60a23d0ad788/zips_us_topo.json')
  .then(response => response.json())
  .then(us => topojson.feature(us, us.objects.zip_codes_for_the_usa));

const cleanInput = value => {
  const num = Number(value);
  return num || num === 0 ? num : '';
};

const input = ({ name, value }) => `
  <input
    autofocus
    required
    type="number"
    placeholder="Longitude"
    name="${name}"
    value="${value}"
    step="0.0000001"
  />
`;

app.get('/where-is-it', async (req, res) => {
  const lng = cleanInput(req.query.lng);
  const lat = cleanInput(req.query.lat);

  let payload = '';

  if (lng !== '' && lat !== '') {
    const countries = await getCountries();
    const location = point([lng, lat]);

    const findFeature = feature => pointInPolygon(location, feature);
    const country = countries.features.find(findFeature);

    payload = {
      lng,
      lat,
      country: country ? country.properties.name : '🤷',
    };

    if (country && country.id === 'USA') {
      const zipcodes = await getUSZipCodes();
      const zipcode = zipcodes.features.find(findFeature);
      if (zipcode) {
        const { name: city, zip, state } = zipcode.properties;
        Object.assign(payload, { city, state, zip });
      }
    }
  }

  if ((req.headers.accept || '').split(',').includes('application/json')) {
    res.json(payload || { error: "You must include `lng` and `lat` url params" });
  } else {
    res.send(`
      <h2>Enter some coordinates to find out more about the location</h2>
      <form method="get">
        ${input({ name: 'lng', value: lng })}
        ${input({ name: 'lat', value: lat })}
        <button type="submit">Where is it?</button>
      </form>
      <pre>${payload && JSON.stringify(payload, null, 2)}</pre>
    `);
  }
});

app.use('/', (req, res) => res.redirect(`${absPathPrefix}/where-is-it`));

if (process.env.LAMBDA_TASK_ROOT) {
  const serverlessExpress = require('aws-serverless-express');
  const server = serverlessExpress.createServer(app);
  exports.handler = (event, context) => serverlessExpress.proxy(server, event, context);
} else {
  app.listen(port, () => console.log(`Listening on port ${port}`));
}
