require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/webhook', async (req, res) => {
  try {
    const { confirmed, chainId, txs = [], erc20Transfers = [] } = req.body;
   
    const messages = [];
    for (const tx of txs) {
      const valueWei = BigInt(tx.value || '0');
      if (valueWei > 0n) {
        const amount = (Number(valueWei) / 1e18).toFixed(6);
        const txId = tx.hash;
        const to = tx.toAddress;
        messages.push(`Received ${amount} BNB to ${to}. Transaction ID: ${txId}`);
      }
    }
    const usdtContract = '0x55d398326f99059ff775485246999027b3197955';
    for (const transfer of erc20Transfers) {
      if (transfer.contract.toLowerCase() === usdtContract) {
        const amount = parseFloat(transfer.valueWithDecimals).toFixed(6);
        const symbol = transfer.tokenSymbol || 'USDT';
        const txId = transfer.transactionHash;
        const to = transfer.to;
        messages.push(`Received ${amount} ${symbol} to ${to}. Transaction ID: ${txId}`);
      }
    }
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    if (!telegramToken || !telegramChatId) {
      console.error('Missing Telegram env vars');
      return res.status(200).json({ success: true });
    }
    for (const msg of messages) {
      const url = `https://api.telegram.org/bot${telegramToken}/sendMessage?chat_id=${telegramChatId}&text=${encodeURIComponent(msg)}`;
      await fetch(url);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ success: true });
  }
});

// Add a root endpoint to test server
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Listen on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
