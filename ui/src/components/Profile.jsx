import { useState } from 'react'

const Profile = ({ profile, setProfile, currentUser }) => {
  const [edit, setEdit] = useState(false)
  const [tempProfile, setTempProfile] = useState(profile)

  const handleSave = () => {
    setProfile(tempProfile)
    localStorage.setItem(`profile_${currentUser.email}`, JSON.stringify(tempProfile))
    setEdit(false)
  }

  return (
    <div className="profile">
      <h2>Profile</h2>
      {edit ? (
        <div>
          <input value={tempProfile.name} onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })} placeholder="Name" />
          <input value={tempProfile.email} onChange={(e) => setTempProfile({ ...tempProfile, email: e.target.value })} placeholder="Email" />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => setEdit(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <p>Name: {profile.name}</p>
          <p>Email: {profile.email}</p>
          <button onClick={() => setEdit(true)}>Edit</button>
        </div>
      )}
    </div>
  )
}

export default Profile