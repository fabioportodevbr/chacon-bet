// Gerador de payload PIX (EMV QR Code — padrão Banco Central do Brasil)

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase().padStart(4, '0'))
}

function emvField(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

export function buildPixPayload(params: {
  pixKey: string
  name: string
  city: string
  amount: number
  txid?: string
  description?: string
}): string {
  const { pixKey, name, city, amount, txid = '***', description = 'CHACON BET' } = params

  const merchantAccountInfo = [
    emvField('00', 'br.gov.bcb.pix'),
    emvField('01', pixKey),
    description ? emvField('02', description.substring(0, 72)) : '',
  ].join('')

  const fields = [
    emvField('00', '01'),                          // payload format indicator
    emvField('26', merchantAccountInfo),            // merchant account info
    emvField('52', '0000'),                         // merchant category code
    emvField('53', '986'),                          // currency BRL
    emvField('54', amount.toFixed(2)),              // amount
    emvField('58', 'BR'),                           // country code
    emvField('59', name.substring(0, 25).toUpperCase()),
    emvField('60', city.substring(0, 15).toUpperCase()),
    emvField('62', emvField('05', txid.substring(0, 25))), // additional data
    '6304',                                         // CRC placeholder
  ].join('')

  return fields + crc16(fields)
}

export function buildQRCodeURL(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`
}
