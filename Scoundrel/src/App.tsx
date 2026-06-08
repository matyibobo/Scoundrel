import React, { useEffect, useState } from 'react'

const App = () => {

  const [deck, setDeck] = useState("")

  useEffect(()=>{
    fetch("https://deckofcardsapi.com/api/deck/new/shuffle/?cards=AC,AS,KC,KS,QC,QS,JC,JS,2H,2S,2D,2C,3H,3S,3D,3C,4H,4S,4D,4C,5H,5S,5D,5C,6H,6S,6D,6C,7H,7S,7D,7C,8H,8S,8D,8C,9H,9S,9D,9C,0H,0S,0D,0C")
    .then(res => res.json())
    .then(data => setDeck(data.deck_id))
  },[])


  return (
    <div>
      {deck}
    </div>
  )
}

export default App