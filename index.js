require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Webhook endpoint for Moralis Streams (supports Ethereum '0x1' and BSC '0x38')
app.post('/api/webhook', async (req, res) => {
  try {
    const { confirmed, chainId, txs = [], erc20Transfers = [] } = req.body;

    // Determine chain-specific details
    const isEthereum = chainId === '0x1';
    const chainName = isEthereum ? 'Ethereum' : 'BSC';
    const explorerUrl = isEthereum ? 'https://etherscan.io/tx/' : 'https://bscscan.com/tx/';
    const usdtContract = isEthereum ? '0xdac17f958d2ee523a2206206994597c13d831ec7' : '0x55d398326f99059ff775485246999027b3197955';

    const messages = [];

    // Handle native incoming (ETH on Ethereum, BNB on BSC)
    for (const tx of txs) {
      const valueWei = BigInt(tx.value || '0');
      if (valueWei > 0n) {
        const amount = (Number(valueWei) / 1e18).toFixed(6);
        const txId = tx.hash;
        messages.push(`Amount : ${amount} "\n" Transaction ID: ${txId} on ${chainName}: ${explorerUrl}${txId}`);
      }
    }

    // Handle USDT incoming transfers (ERC20 on Ethereum, BEP20 on BSC)
    // Remove the if() below to include all ERC20/BEP20 tokens, not just USDT
    for (const transfer of erc20Transfers) {
      if (transfer.contract.toLowerCase() === usdtContract) {
        const txId = transfer.transactionHash;
        const amount = parseFloat(transfer.valueWithDecimals).toFixed(6);
        messages.push(`Amount : ${amount} "\n" Transaction ID: ${txId} on ${chainName}: ${explorerUrl}${txId}`);
      }
    }

    // Send messages to Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !telegramChatId) {
      console.error('Missing Telegram env vars');
      return res.status(200).json({ success: true });
    }

    for (const msg of messages) {
      const url = `https://api.telegram.org/bot${telegramToken}/sendMessage?chat_id=${telegramChatId}&text=${encodeURIComponent(msg)}`;
      await fetch(url); // Async, non-blocking
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ success: true }); // Avoid Moralis retries
  }
});

// Test endpoint to verify server is running
app.get('/', (req, res) => {
  res.send('Server is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;