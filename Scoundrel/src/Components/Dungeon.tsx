import React, { useEffect, useState } from 'react'

export type cardType = {
    code: string,
    image: string,
    value: number,
    suit: string
}


const Dungeon = (id: string) => {
    const [cards, setCards] = useState<cardType[]>()
    const [remains, setRemains] = useState()

    const Draw = () =>{
        fetch(`https://deckofcardsapi.com/api/deck/${id}/draw/?count=4`)
        .then(res => res.json())
        .then(data => {setCards(data.cards), setRemains(data.remaining)})
    }

    return (
        <div>
            {remains}
            <button onClick={() => Draw()}></button>
        </div>
    )
}

export default Dungeon