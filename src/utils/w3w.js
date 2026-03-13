const W3W_KEY = import.meta.env.VITE_W3W_API_KEY

export async function coordsToW3W(lat, lng) {
  if (!W3W_KEY) return null
  try {
    const res  = await fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${W3W_KEY}`)
    const data = await res.json()
    return data.words || null
  } catch {
    return null
  }
}

export async function w3wToCoords(words) {
  if (!W3W_KEY) return null
  const clean = words.replace(/^\/\/\//, '').trim().toLowerCase()
  if (!clean || clean.split('.').length !== 3) return null
  try {
    const res  = await fetch(`https://api.what3words.com/v3/convert-to-coordinates?words=${clean}&key=${W3W_KEY}`)
    const data = await res.json()
    if (data.error) return null
    return data.coordinates || null
  } catch {
    return null
  }
}
