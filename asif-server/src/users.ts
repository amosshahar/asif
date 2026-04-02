import fs from 'fs'
import path from 'path'
import { User } from './types'

const FILE = path.join(__dirname, '../data/users.json')

export function readUsers(): User[] {
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
}

export function writeUsers(users: User[]): void {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2), 'utf-8')
}

export function findUser(id: string): User | undefined {
  return readUsers().find(u => u.id === id)
}
