try { require('dotenv').config({ path: require('path').join(__dirname, '../../.env') }); } catch (_) {}
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SwapDeck backend running on http://localhost:${PORT}`);
});
