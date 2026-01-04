const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const certDir = path.join(__dirname, '..', 'certs');

(async () => {
    console.log('Generating certs (async check)...');
    try {
        let pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 365 });

        if (pems instanceof Promise) {
            console.log('selfsigned.generate returned a Promise, awaiting...');
            pems = await pems;
        }

        console.log('Pems generated. Keys:', Object.keys(pems));

        if (pems.private) {
            fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);
            console.log('key.pem written');
        }
        if (pems.cert) {
            fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
            console.log('cert.pem written');
        }
    } catch (e) {
        console.error('Error generating/writing certs:', e);
    }

    console.log('Listing cert dir:');
    try {
        const files = fs.readdirSync(certDir);
        console.log('Files:', files);
    } catch (e) {
        console.error('Error listing dir:', e);
    }
})();
