import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { generateRSAKeyPair, storePrivateKey } from '../utils/crypto'

export default function Register(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { register } = useAuth()
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    
    try{
      // Generate RSA key pair
      setError('Generating encryption keys...')
      const { publicKey, privateKey } = await generateRSAKeyPair()
      
      // Register user with public key
      setError('Creating account...')
      const response = await register({ 
        username: name, 
        email, 
        password,
        rsaPublicKey: publicKey 
      })
      
      // Store private key locally
      storePrivateKey(response.user?.id || response.id, privateKey)
      
      setError('Registration successful! Redirecting...')
      setTimeout(() => nav('/login'), 1000)
    }catch(err){
      setError(err?.response?.data?.message || err?.message || 'Registration failed')
    }
  }

  return (
    <div>
      <h2>Register</h2>
      <form className="form" onSubmit={submit}>
        <input className="input" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit" disabled={!name || !email || !password}>Register</button>
        {error && <div style={{color: error.includes('successful') ? 'green' : error.includes('Generating') || error.includes('Creating') ? 'blue' : 'red'}}>{error}</div>}
      </form>
    </div>
  )
}
