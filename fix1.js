const fs = require('fs');

const fileContent = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /{bookingType !== 'selection' && \([\s\S]+?{bookingType === 'mesa' && \(/g;

const result = fileContent.replace(
  "{bookingType !== 'selection' && (",
  ""
);

fs.writeFileSync('src/App.tsx', result, 'utf8');
