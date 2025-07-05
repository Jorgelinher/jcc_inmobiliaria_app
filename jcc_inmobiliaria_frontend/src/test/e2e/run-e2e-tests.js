#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Ejecutando Tests E2E...\n');

const testFiles = [
  'LoginFlow.test.jsx',
  'VentaFlow.test.jsx',
  'DashboardFlow.test.jsx'
];

let passedTests = 0;
let failedTests = 0;

testFiles.forEach((testFile, index) => {
  console.log(`\n📋 Test ${index + 1}/${testFiles.length}: ${testFile}`);
  console.log('='.repeat(50));
  
  try {
    const testPath = path.join(__dirname, testFile);
    const result = execSync(`npx jest "${testPath}" --config ../jest.e2e.config.js --verbose --no-coverage`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ PASÓ');
    console.log(result);
    passedTests++;
    
  } catch (error) {
    console.log('❌ FALLÓ');
    console.log(error.stdout || error.message);
    failedTests++;
  }
});

console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE TESTS E2E');
console.log('='.repeat(50));
console.log(`✅ Tests que pasaron: ${passedTests}`);
console.log(`❌ Tests que fallaron: ${failedTests}`);
console.log(`📈 Total de tests: ${testFiles.length}`);

if (failedTests === 0) {
  console.log('\n🎉 ¡Todos los flujos E2E pasaron exitosamente!');
  process.exit(0);
} else {
  console.log('\n⚠️  Algunos flujos E2E fallaron. Revisa los errores arriba.');
  process.exit(1);
} 