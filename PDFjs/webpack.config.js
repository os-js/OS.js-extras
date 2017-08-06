const path = require('path');
const osjs = require('osjs-build');

module.exports = new Promise((resolve, reject) => {
  const metadataFile = path.join(__dirname, 'metadata.json');

  osjs.webpack.createPackageConfiguration(metadataFile).then((result) => {
    result.config.entry = {
      'main': result.config.entry,
      'pdf.worker': 'node_modules/pdfjs-dist/build/pdf.worker.entry'
    };

    resolve(result.config);
  }).catch(reject);
});
