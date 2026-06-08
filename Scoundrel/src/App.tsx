import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = 'https://deckofcardsapi.com/api/deck/new/draw/?count=52'
const MAX_HP = 20
const CARD_BACK = 'https://deckofcardsapi.com/static/img/back.png'

type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS'
type CardKind = 'monster' | 'weapon' | 'potion'
type GameStatus = 'loading' | 'playing' | 'won' | 'lost' | 'error'

type ApiCard = {
  code: string
  image: string
  value: string
  suit: Suit
}

type DeckApiResponse = {
  success: boolean
  deck_id: string
  remaining: number
  cards: ApiCard[]
}

type GameCard = ApiCard & {
  power: number
  kind: CardKind
  label: string
  suitIcon: string
  color: 'red' | 'black'
}

type WeaponState = {
  card: GameCard
  slain: GameCard[]
}

type GameState = {
  status: GameStatus
  deck: GameCard[]
  room: GameCard[]
  weapon: WeaponState | null
  hp: number
  message: string
  potionUsedThisRoom: boolean
  actionsInRoom: number
  fledLastRoom: boolean
  selectedMonster: GameCard | null
  defeated: number
  turns: number
}

const emptyGame: GameState = {
  status: 'loading',
  deck: [],
  room: [],
  weapon: null,
  hp: MAX_HP,
  message: 'Neon pakli töltése...',
  potionUsedThisRoom: false,
  actionsInRoom: 0,
  fledLastRoom: false,
  selectedMonster: null,
  defeated: 0,
  turns: 0,
}

function getPower(value: string): number {
  if (value === 'ACE') return 14
  if (value === 'KING') return 13
  if (value === 'QUEEN') return 12
  if (value === 'JACK') return 11
  return Number(value)
}

function getSuitIcon(suit: Suit): string {
  if (suit === 'SPADES') return '♠'
  if (suit === 'CLUBS') return '♣'
  if (suit === 'DIAMONDS') return '♦'
  return '♥'
}

function getKind(suit: Suit): CardKind {
  if (suit === 'DIAMONDS') return 'weapon'
  if (suit === 'HEARTS') return 'potion'
  return 'monster'
}

function isRemovedFromScoundrel(card: ApiCard): boolean {
  const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS'
  const isRedAceOrFace = ['ACE', 'KING', 'QUEEN', 'JACK'].includes(card.value)
  return isRed && isRedAceOrFace
}

function toGameCard(card: ApiCard): GameCard {
  const power = getPower(card.value)
  const suitIcon = getSuitIcon(card.suit)
  return {
    ...card,
    power,
    suitIcon,
    kind: getKind(card.suit),
    color: card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'red' : 'black',
    label: `${card.value} ${suitIcon}`,
  }
}

function drawRoom(deck: GameCard[], room: GameCard[]) {
  const nextDeck = [...deck]
  const nextRoom = [...room]

  while (nextRoom.length < 4 && nextDeck.length > 0) {
    const card = nextDeck.shift()
    if (card) nextRoom.push(card)
  }

  return { deck: nextDeck, room: nextRoom }
}

function removeCard(room: GameCard[], card: GameCard) {
  return room.filter((roomCard) => roomCard.code !== card.code)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function canUseWeapon(monster: GameCard, weapon: WeaponState | null): boolean {
  if (!weapon) return false
  const lastMonsterKilled = weapon.slain[weapon.slain.length - 1]
  return !lastMonsterKilled || monster.power <= lastMonsterKilled.power
}

function buildGame(cards: ApiCard[]): GameState {
  const dungeon = cards.filter((card) => !isRemovedFromScoundrel(card)).map(toGameCard)
  const firstRoom = drawRoom(dungeon, [])

  return {
    ...emptyGame,
    status: 'playing',
    deck: firstRoom.deck,
    room: firstRoom.room,
    message: 'Choose 3 cards or flee.',
  }
}

function countThreat(cards: GameCard[]) {
  return cards
    .filter((card) => card.kind === 'monster')
    .reduce((total, card) => total + card.power, 0)
}

function cardTypeText(card: GameCard) {
  if (card.kind === 'monster') return `Monster • ${card.power} damage`
  if (card.kind === 'weapon') return `Weapon • ${card.power} strength`
  return `Potion • +${card.power} HP`
}

function finishAction(next: GameState, message: string): GameState {
  let updated: GameState = {
    ...next,
    message,
    selectedMonster: null,
    turns: next.turns + 1,
  }

  if (updated.hp <= 0) {
    const dangerLeft = countThreat([...updated.deck, ...updated.room])
    return {
      ...updated,
      hp: 0,
      status: 'lost',
      message: `You've got killed, danger left: ${dangerLeft}.`,
    }
  }

  if (updated.deck.length === 0 && updated.room.length === 0) {
    return {
      ...updated,
      status: 'won',
      message: `You won! Score: ${updated.hp} HP.`,
    }
  }

  if (updated.room.length <= 1 && updated.deck.length > 0) {
    const dealt = drawRoom(updated.deck, updated.room)
    updated = {
      ...updated,
      deck: dealt.deck,
      room: dealt.room,
      potionUsedThisRoom: false,
      actionsInRoom: 0,
      fledLastRoom: false,
      message: `${message} New room.`,
    }
  }

  return updated
}

export default function App() {
  const [game, setGame] = useState<GameState>(emptyGame)

  const startNewGame = useCallback(async () => {
    setGame({ ...emptyGame })

    try {
      const response = await fetch(API_URL)
      const data = (await response.json()) as DeckApiResponse

      if (!data.success || !Array.isArray(data.cards)) {
        throw new Error()
      }

      setGame(buildGame(data.cards))
    } catch (error) {
      console.error(error)
      setGame({
        ...emptyGame,
        status: 'error',
        message: 'Something went wrong.',
      })
    }
  }, [])

  useEffect(() => {
    void startNewGame()
  }, [startNewGame])

  const canFlee =
    game.status === 'playing' &&
    game.room.length === 4 &&
    game.actionsInRoom === 0 &&
    !game.fledLastRoom

  const hpPercent = Math.max(0, Math.min(100, (game.hp / MAX_HP) * 100))

  const dungeonThreat = useMemo(
    () => countThreat([...game.deck, ...game.room]),
    [game.deck, game.room],
  )

  function fleeRoom() {
    setGame((current) => {
      const allowed =
        current.status === 'playing' &&
        current.room.length === 4 &&
        current.actionsInRoom === 0 &&
        !current.fledLastRoom

      if (!allowed) return current

      const returnedCards = shuffle(current.room)
      const nextDungeon = [...current.deck, ...returnedCards]
      const dealt = drawRoom(nextDungeon, [])

      return {
        ...current,
        deck: dealt.deck,
        room: dealt.room,
        potionUsedThisRoom: false,
        actionsInRoom: 0,
        fledLastRoom: true,
        selectedMonster: null,
        turns: current.turns + 1,
        message: 'You got away safely.',
      }
    })
  }

  function handlePotion(card: GameCard) {
    setGame((current) => {
      if (current.status !== 'playing') return current

      const healed = current.potionUsedThisRoom ? 0 : card.power
      const nextHp = current.potionUsedThisRoom
        ? current.hp
        : Math.min(MAX_HP, current.hp + card.power)

      const next: GameState = {
        ...current,
        room: removeCard(current.room, card),
        hp: nextHp,
        potionUsedThisRoom: true,
        actionsInRoom: current.actionsInRoom + 1,
      }

      const message = healed > 0
        ? `You drank a potion: +${healed} HP.`
        : 'Second potion got discard.'

      return finishAction(next, message)
    })
  }

  function handleWeapon(card: GameCard) {
    setGame((current) => {
      if (current.status !== 'playing') return current

      const oldWeaponText = current.weapon ? ` You threw away your previous weapon: ${current.weapon.card.power}.` : ''
      const next: GameState = {
        ...current,
        room: removeCard(current.room, card),
        weapon: { card, slain: [] },
        actionsInRoom: current.actionsInRoom + 1,
      }

      return finishAction(next, `Picked up ${card.power} weapon.${oldWeaponText}`)
    })
  }

  function selectMonster(card: GameCard) {
    setGame((current) => {
      if (current.status !== 'playing') return current
      return {
        ...current,
        selectedMonster: current.selectedMonster?.code === card.code ? null : card,
        message: `Monster: ${card.label}. Choose attack type.`,
      }
    })
  }

  function handleCardClick(card: GameCard) {
    if (card.kind === 'potion') handlePotion(card)
    if (card.kind === 'weapon') handleWeapon(card)
    if (card.kind === 'monster') selectMonster(card)
  }

  function fightMonster(useWeapon: boolean) {
    setGame((current) => {
      if (current.status !== 'playing' || !current.selectedMonster) return current

      const monster = current.selectedMonster
      let damage = monster.power
      let weapon = current.weapon
      let message = `You've defeated the ${monster.power} monster unarmed, but it dealt ${damage} damage to you.`

      if (useWeapon && canUseWeapon(monster, current.weapon) && current.weapon) {
        damage = Math.max(0, monster.power - current.weapon.card.power)
        weapon = {
          ...current.weapon,
          slain: [...current.weapon.slain, monster],
        }
        message = `You've defeated the monster. Monster: ${monster.power}, weapon: ${current.weapon.card.power}, damage: ${damage}.`
      }

      const next: GameState = {
        ...current,
        room: removeCard(current.room, monster),
        weapon,
        hp: current.hp - damage,
        actionsInRoom: current.actionsInRoom + 1,
        defeated: current.defeated + 1,
      }

      return finishAction(next, message)
    })
  }

  const selectedMonster = game.selectedMonster
  const weaponLimit = game.weapon?.slain.at(-1)?.power ?? null
  const selectedCanUseWeapon = selectedMonster ? canUseWeapon(selectedMonster, game.weapon) : false

  return (
    <main className="quest-app">
      <header className="quest-header">
        <div className="brand-block">
          <h1>Scoundrel game</h1>
        </div>

        <div className="header-actions">
          <button className="restart-button" onClick={startNewGame}>
            New game
          </button>
        </div>
      </header>

      {game.status === 'loading' && (
        <section className="notice-card">
          <div className="coin-loader" />
          <h2>Shuffling...</h2>
        </section>
      )}

      {game.status === 'error' && (
        <section className="notice-card bad-news">
          <p>{game.message}</p>
          <button className="restart-button" onClick={startNewGame}>Try again</button>
        </section>
      )}

      {(game.status === 'won' || game.status === 'lost') && (
        <section className={`notice-card final-card ${game.status}`}>
          <span className="stamp">{game.status === 'won' ? 'You won' : 'You lost'}</span>
          <h2>{game.status === 'won' ? 'Hell yeah' : 'Hell nah'}</h2>
          <p>{game.message}</p>
          <div className="result-grid">
            <span>Turns: <b>{game.turns}</b></span>
            <span>Defeated  monsters: <b>{game.defeated}</b></span>
            <span>Cards left: <b>{game.deck.length + game.room.length}</b></span>
          </div>
          <button className="restart-button" onClick={startNewGame}>New game</button>
        </section>
      )}

      {game.status === 'playing' && (
        <section className="tavern-layout">
          <aside className="character-sheet">
            <div className="portrait-card">
              <div className="avatar">🗡️</div>
              <div>
                <span className="stamp">Player</span>
                <h2>Stats</h2>
              </div>
            </div>

            <div className="health-wheel" style={{ '--hp': `${hpPercent}%` } as React.CSSProperties}>
              <div>
                <strong>{game.hp}</strong>
                <span>/ {MAX_HP} HP</span>
              </div>
            </div>

            <div className="sheet-stats">
              <article>
                <span>Deck</span>
                <b>{game.deck.length}</b>
              </article>
              <article>
                <span>Threat</span>
                <b>{dungeonThreat}</b>
              </article>
              <article>
                <span>Turn</span>
                <b>{game.turns}</b>
              </article>
              <article>
                <span>Kill</span>
                <b>{game.defeated}</b>
              </article>
            </div>

            <button className="flee-card" onClick={fleeRoom} disabled={!canFlee}>
              <span>↩</span>
              <div>
                <b>Flee</b>
              </div>
            </button>
          </aside>

          <section className="route-board">
            <div className="board-heading">
              <div>
                <span className="stamp">Current path</span>
                <h2>Cards:</h2>
              </div>
              <p>{game.message}</p>
            </div>

            <div className="path-line" aria-hidden="true" />

            <div className="encounter-path">
              {game.room.map((card, index) => (
                <button
                  key={card.code}
                  className={`quest-card point-${index} ${card.kind} ${card.color} ${selectedMonster?.code === card.code ? 'chosen' : ''}`}
                  onClick={() => handleCardClick(card)}
                >
                  <span className="pin">{index + 1}</span>
                  <img src={card.image} alt={card.label} />
                  <div className="card-note">
                    <b>{card.label}</b>
                    <small>{cardTypeText(card)}</small>
                  </div>
                </button>
              ))}

              {game.room.length === 0 && (
                <div className="empty-route">
                  <img src={CARD_BACK} />
                  <p>No more visible card.</p>
                </div>
              )}
            </div>

            {selectedMonster && (
              <div className="combat-drawer">
                <div>
                  <span className="stamp">Fight</span>
                  <h3>{selectedMonster.label}</h3>
                  <p>
                    The monster's power: {selectedMonster.power}. Attack with your weapon or with bare fists?
                  </p>
                </div>
                <div className="combat-buttons">
                  <button
                    className="attack-weapon"
                    disabled={!selectedCanUseWeapon}
                    onClick={() => fightMonster(true)}
                  >
                    Weapon
                  </button>
                  <button className="attack-bare" onClick={() => fightMonster(false)}>
                    Unarmed
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="inventory-column">
            <section className="inventory-box weapon-box">
              <span className="stamp">Inventory</span>
              <h2>Weapon</h2>
              {game.weapon ? (
                <div className="weapon-summary">
                  <img src={game.weapon.card.image} alt={game.weapon.card.label} />
                  <div>
                    <b>{game.weapon.card.power} strength</b>
                    <small>
                      Next limit:{' '}
                      {weaponLimit === null ? 'none' : `${weaponLimit} or less`}
                    </small>
                  </div>
                </div>
              ) : (
                <p className="muted">No weapon</p>
              )}

              <div className="monster-tags">
                {game.weapon?.slain.length ? (
                  game.weapon.slain.map((monster) => (
                    <span key={monster.code}>☠ {monster.power}</span>
                  ))
                ) : (
                  <small>No monster defeated.</small>
                )}
              </div>
            </section>

            <section className="inventory-box deck-box">
              <span className="stamp">Deck</span>
              <div className="deck-visual">
                <img src={CARD_BACK} alt="Dungeon deck" />
                <div>
                  <b>{game.deck.length}</b>
                </div>
              </div>
            </section>

            <section className="inventory-box guide-box">
              <span className="stamp">rules</span>
              <ul>
                <li>♠ and ♣ monster.</li>
                <li>♦ weapon.</li>
                <li>♥ potion, 1/room.</li>
                <li>Flee is only avaliable when you didn't fleed from the previous room.</li>
              </ul>
            </section>
          </aside>
        </section>
      )}
    </main>
  )
}
