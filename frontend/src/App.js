import React, { Component } from 'react';
import { QRCode } from 'react-qr-svg';
import Toggle from 'react-toggle'
import "react-toggle/style.css" // for ES6 modules
import logo from './hydroLogo.svg';
import './App.css';

var JsonTable = require('ts-react-json-table');

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      database: [{}],

      QREnabled: JSON.parse(sessionStorage.getItem('QREnabled')) || false,
      raindropEnabled: false,
      hydroIDConfirmed: false,

      internalUsername: sessionStorage.getItem('internalUsername') || 'TestUser', // for demonstration purposes only
      claimedHydroID: '',
      linkedHydroID: null,

      signUpStatus: '',
      firstTimeVerificationStatus: '',
      verificationStatus: '',
    };

    this.getMessage();
    this.getLinkedHydroID();

    this.registerUser = this.registerUser.bind(this);
    this.verify = this.verify.bind(this);
    this.unregisterUser = this.unregisterUser.bind(this);

    this.refreshDatabase = this.refreshDatabase.bind(this);

    this.internalUsernameChange = this.internalUsernameChange.bind(this);
    this.toggleQRCodes = this.toggleQRCodes.bind(this);
    this.claimedHydroIDChange = this.claimedHydroIDChange.bind(this);
  }

  // render the main page
  render() {
    return (
      <div className="App">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>Client-Side Raindrop Demo</h1>
        <div>Enable QR codes? <Toggle
          defaultChecked={this.state.QREnabled}
          onChange={this.toggleQRCodes} />
        </div>
        <hr color="black"></hr>
        {this.body()}
        <hr color="black"></hr>
        <h2>Session Data</h2>
        <label>Internal Username: </label><input type="text" value={this.state.internalUsername} onChange={this.internalUsernameChange} />
        {this.hydroIDStatus()}
        <br/>
        <h2>Database</h2>
        <JsonTable className='table' rows = {this.state.database} />
        <br/>
      </div>
    );
  }

  // toggle QR/message display
  toggleQRCodes (event) {
    this.setState({QREnabled: event.target.checked});
    sessionStorage.setItem('QREnabled', JSON.stringify(event.target.checked));
  };

  // displays the appropriate html depending on whether or not the internal user has raindrop enabled or not
  body () {
    if (!this.state.raindropEnabled || !this.state.hydroIDConfirmed) {
      return (
        <div>
          <h2>First Time Sign-Up</h2>
            <form onSubmit={this.registerUser}>
              Enter your HydroID:
              {' '}
              <input type="text" value={this.state.claimedHydroID} onChange={this.claimedHydroIDChange} />
              {' '}
              <input type="submit" value=" Link " />
            </form>
            <br/>
            <div className={this.state.signUpStatus === "" ? "result-box hidden" : "result-box"}>
              {this.state.signUpStatus}
            </div>
            <br/>
            <p className="text">
              To complete your sign-up, {this.state.QREnabled ? "scan": "enter"}
              {' '}
              this code in the Hydro mobile app:
            </p>
            {this.renderMessage()}
            <form onSubmit={(event) => this.verify(event, "firstTimeVerificationStatus")}>
              <input type="submit" value=" Authenticate " />
            </form>
            <br/>
            <div className={this.state.firstTimeVerificationStatus === "" ? "result-box hidden" : "result-box"}>
              {this.state.firstTimeVerificationStatus}
            </div>
            <br/>
          </div>
        )
    } else {
      return (
        <div>
          <h2>Authentication</h2>
          <p className="text"> {this.state.QREnabled ? "Scan": "Enter"} the code below in the Hydro mobile app</p>
          {this.renderMessage()}
          <form onSubmit={(event) => this.verify(event, "verificationStatus")}>
            <input type="submit" value=" Authenticate " />
          </form>
          <br/>
          <div className={this.state.verificationStatus === "" ? "result-box hidden" : "result-box"}>
            {this.state.verificationStatus}
          </div>
        </div>
      )
    }
  }

  // updates the claimed hydroID on form change
  claimedHydroIDChange (event) {
    this.setState({claimedHydroID: event.target.value});
  }

  // registers a user for Raindrop 2FA
  registerUser (event) {
    event.preventDefault();
    this.setState({signUpStatus: 'Loading...'})
    return fetch('/registerUser', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        internalUsername: this.state.internalUsername,
        hydroID: this.state.claimedHydroID
      })
    })
      .then(response => { return response.json() })
      .then(data => {
        if (data.registered) {
          this.setState({signUpStatus: 'Successful link, proceed to complete sign-up'})
          this.getLinkedHydroID(this.state.internalUsername);
        } else {
          this.setState({signUpStatus: 'Unsuccessful link (check backend logs)'})
        }
      })
      .catch(error => {
        console.log(error)
        this.setState({signUpStatus: 'Error (check frontend logs)'})
      });
  };

  // gets a message for the user to sign
  getMessage () {
    fetch('/message', {
      method: 'GET',
      credentials: 'include'
    })
      .then(response => { return response.json() })
      .then(json => { this.setState({messageToSign: json.message}) })
      .catch(error => { console.log(error) });
  }

  // show QR codes/messages
  renderMessage () {
    if (this.state.QREnabled && this.state.messageToSign) {
      return (
        <div>
          <br/>
          <QRCode
            bgColor="#FFFFFF"
            fgColor="#4F8FF3"
            level="Q"
            style={{ width: 256 }}
            value={this.state.messageToSign}
          />
          <br/>
          <br/>
        </div>
      )
    } else {
      return (<p><font size="+3">{this.state.messageToSign}</font></p>)
    }
  }

  // verifies a message (treats first-time verification requests differently that ongoing requests from verified users)
  verify (event, updateField) {
    event.preventDefault();
    this.setState({[updateField]: 'Loading...'})
    return fetch(`/verifySignature`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      // we only need to pass the user's internal identifier, their hydro username is already stored in the backend
      body: JSON.stringify({internalUsername: this.state.internalUsername})
    })
      .then(response => { return response.json() })
      .then(data => {
        if (data.verified) {
          if (updateField === "firstTimeVerificationStatus") {
            this.setState({[updateField]: 'Success! Redirecting, please wait...'})
            setTimeout(() => {
              this.getLinkedHydroID(this.state.internalUsername)
              this.getMessage()
              this.setState({
                signUpStatus: "", firstTimeVerificationStatus: "", verificationStatus: "", claimedHydroID: ""
              })
            }, 4000)
          } else {
            this.setState({[updateField]: 'Success!'})
          }
        } else {
          this.setState({[updateField]: 'Failure (check backend logs)'})
        }
      })
      .catch(error => {
        this.setState({[updateField]: 'Error (check frontend logs)'})
        console.log(error)
      });
  };

  // updates the internal username. Different names correspond to different users/session
  // WARNING: FOR EXAMPLE PURPOSES ONLY. In reality, sessions obviously should not be manipulable by users.
  internalUsernameChange (event) {
    this.setState({internalUsername: event.target.value});
    sessionStorage.setItem('internalUsername', event.target.value);
    this.getLinkedHydroID(event.target.value);
  }

  // displays the status of the current internal user's linking process
  hydroIDStatus () {
    if (this.state.raindropEnabled) {
      return (
        <div>
          Your account <strong>does</strong> have Raindrop 2FA enabled, {this.state.hydroIDConfirmed ? 'and ' : 'but '}
          it is <strong>{this.state.hydroIDConfirmed ? 'confirmed' : 'unconfirmed'}</strong>.
          <br/>
          Your HydroID is saved as: <strong>{this.state.linkedHydroID}</strong>.
          <br/>
          <br/>
          <form onSubmit={this.unregisterUser}>
            <input type="submit" value=" Unregister " />
          </form>
        </div>
      )
    } else {
      return (
        <div>
          Your account <strong>does not</strong> have Raindrop 2FA enabled.
        </div>
      )
    }
  }

  // updates state variables that define the state of the internal users's linkage to raindrop 2FA
  async getLinkedHydroID () {
    await this.refreshDatabase()
    fetch('/isInDatabase', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        internalUsername: this.state.internalUsername
      })
    })
      .then(response => { return response.json() })
      .then(data => {
        if (data.exists) {
          this.setState(
            {linkedHydroID: data.hydroID, hydroIDConfirmed: data.confirmed, raindropEnabled: true}
          )
        } else {
          this.setState({linkedHydroID: null, hydroIDConfirmed: false, raindropEnabled: false})
        }
      })
      .catch(error => {
        this.setState({linkedHydroID: null, hydroIDConfirmed: false, raindropEnabled: false})
        console.log(error)
      });
  }

  // unregisters a user for Raindrop 2FA
  unregisterUser (event) {
    event.preventDefault();
    return fetch('/unregisterUser', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        internalUsername: this.state.internalUsername
      })
    })
      .then(() => {
        this.getLinkedHydroID(this.state.internalUsername);
      })
      .catch(error => {
        console.log(error)
      });
  };

  // updates the displayed database at the bottom of the page from the backend. FOR EXAMPLE PURPOSES ONLY
  refreshDatabase () {
    fetch('/getDatabase', {
      method: 'GET',
      credentials: 'include'
    })
      .then(response => { return response.json() })
      .then(data => { this.setState({database: data}) })
      .catch(error => { console.log(error) });
  }
}

export default App;
