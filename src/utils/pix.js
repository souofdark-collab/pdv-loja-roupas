function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id, value) {
  const v = String(value ?? '');
  const len = v.length.toString().padStart(2, '0');
  return `${id}${len}${v}`;
}

function stripDiacritics(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function buildPixPayload({ chave, nome, cidade, valor, txid = '***' }) {
  if (!chave) return '';
  const nomeClean = stripDiacritics(nome || 'PDV').slice(0, 25);
  const cidadeClean = stripDiacritics(cidade || 'BR').slice(0, 15);
  const payloadFormat = field('00', '01');
  const merchantAccount = field('26',
    field('00', 'br.gov.bcb.pix') + field('01', chave)
  );
  const merchantCategory = field('52', '0000');
  const transactionCurrency = field('53', '986');
  const transactionAmount = valor ? field('54', Number(valor).toFixed(2)) : '';
  const countryCode = field('58', 'BR');
  const merchantName = field('59', nomeClean);
  const merchantCity = field('60', cidadeClean);
  const additionalData = field('62', field('05', txid));
  const body = payloadFormat + merchantAccount + merchantCategory +
    transactionCurrency + transactionAmount + countryCode +
    merchantName + merchantCity + additionalData + '6304';
  return body + crc16(body);
}
