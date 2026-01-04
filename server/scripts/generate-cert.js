const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

console.log('Generating certificates...');
const attrs = [{ name: 'commonName', value: 'localhost' }];
try {
    const pems = selfsigned.generate(attrs, { days: 365 });
    console.log('Keys generated. Keys:', Object.keys(pems));

    const certDir = path.join(__dirname, '..', 'certs');
    if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir);
    }

    if (pems.private) {
        fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);
    } else {
        console.error('Private key missing in result');
    }

    if (pems.cert) {
        fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
    } else {
        console.error('Certificate missing in result');
    }

    console.log('Certificates generated in', certDir);
} catch (e) {
    console.error('Error generating certificates:', e);
}
