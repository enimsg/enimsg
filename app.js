$(function() {
  var userProfile;

  var webAuth = new auth0.WebAuth({
    domain: AUTH0_DOMAIN,
    clientID: AUTH0_CLIENT_ID,
    redirectUri: AUTH0_CALLBACK_URL,
    responseType: 'token id_token',
    scope: 'openid profile email',
    leeway: 60
  });

  var homeView = $('#home-view');
  var getMsgView = $('#getmsg-view');
  var sendMsgView = $('#sendmsg-view');
  var getKeyView = $('#getkey-view');

  // buttons and event listeners
  var loginBtn = $('#qsLoginBtn');
  var logoutBtn = $('#qsLogoutBtn');
  var homeViewBtn = $('#tab-home-view');
  var getKeyViewBtn = $('#tab-getkey-view');
  
  // ***************************
  var getMsgViewBtn = $('#tab-getmsg-view');
  var getMsgBtn = $('#btn-get-msg');

  var sendMsgViewBtn = $('#tab-sendmsg-view');
  var sendMsgBtn = $('#btn-send-msg');
  // ***************************
  
  homeViewBtn.click(function(e) {
    e.preventDefault();
    homeView.removeClass('hidden');
    getMsgView.addClass('hidden');
    sendMsgView.addClass('hidden');
    getKeyView.addClass('hidden');
  });

    loginBtn.click(function(e) {
    e.preventDefault();
    authorize();
  });

  logoutBtn.click(logout);
  
  // ***************************
  getMsgViewBtn.click(function(e) {
    e.preventDefault();
    homeView.addClass('hidden');
    getMsgView.removeClass('hidden');
    sendMsgView.addClass('hidden');
    getKeyView.addClass('hidden');
  });

  getMsgBtn.click(function(e) {
    e.preventDefault();
    getMsg();
  });
  
  function getMsg() {
    if (isAuthenticated()) {
      $("#msg-info samp").html('&nbsp;');
      $("#getmsg-error").parents(".alert").addClass('hidden');
      const options = {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('access_token')
        }
      };
      $.get(GET_MSG_API + "?access_token="+localStorage.getItem('id_token') + "&" + $("#form-get-msg").serialize())
        .done(function(data){
          // $(".full-msg").text(JSON.stringify(data,null, 2));
          $("#msg-text").text(data.msg_text);
          $("#msg-from").text(data.msg_from);
          // $(".msg-to").text(data.key_hash);
        })
        .fail(function(err){
          console.log(err);
          $("#getmsg-error").parents(".alert").removeClass('hidden');
          if (err.isBoom) {
            $("#getmsg-error").text(err.output.payload.message);
          } else {
            $("#getmsg-error").text(err.responseText);
          }
        });
    } else {
      authorize();
    }
  }

//=================================

  sendMsgViewBtn.click(function(e) {
    e.preventDefault();
    homeView.addClass('hidden');
    getMsgView.addClass('hidden');
    sendMsgView.removeClass('hidden');
    getKeyView.addClass('hidden');
  });

  sendMsgBtn.click(function(e) {
    e.preventDefault();
    sendMsg();
  });

  function sendMsg() {
    if (isAuthenticated()) {
      $("#sent-msg-keyhash").text("");
      $("#sent-msg-info").addClass('hidden');
      $("#sendmsg-error").parents(".alert").addClass('hidden');
      const dataSend = $("#form-send-msg").serialize();
      const options = {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('access_token')
        }
      };
      $.post(SEND_MSG_API + "?access_token="+localStorage.getItem('id_token'), dataSend)
        .done(function(data){
          console.log(data);
          $("#sent-msg-keyhash").text(data.key_hash);
          $("#sent-msg-info").removeClass('hidden');
        })
        .fail(function(err){
          console.log(err);
          $("#sendmsg-error").parents(".alert").removeClass('hidden');
          if (err.isBoom) {
            $("#sendmsg-error").text(err.output.payload.message);
          } else{
            $("#sendmsg-error").text(err.responseText);
          }
        });
    } else {
      authorize();
    }
  }

  //=================================

  getKeyViewBtn.click(function(e) {
    e.preventDefault();
    homeView.addClass('hidden');
    getMsgView.addClass('hidden');
    sendMsgView.addClass('hidden');
    getKeyView.removeClass('hidden');
  });

  $("#btn-get-key").click(function(e) {
    e.preventDefault();
    getKey();
  });

  function getKey() {
    if (isAuthenticated()) {
      $("#key-info dd").html('&nbsp;');
      $("#getkey-error").parents(".alert").addClass('hidden');
      const options = {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('access_token')
        }
      };
      $.get(GET_KEY_API + "?access_token="+localStorage.getItem('id_token') + "&" + $("#form-get-key").serialize())
        .done(function(data){
          let toRoman = {
                0: 'I', 1: 'II', 2: 'III', 3: 'IV',
                4: 'V', 5: 'VI', 6: 'VII', 7: 'VIII'
              };
          $("#key-rotor").text(data.rotors.split('').map(x => toRoman[x]).join(' '));
          $("#key-reflector").text(data.reflector);
          $("#key-ground").text(data.positions);
          $("#key-ring").text(data.rings);
          $("#key-plugboard").text(data.plugboard);
        })
        .fail(function(err){
          console.log(err);
          $("#getkey-error").parents(".alert").removeClass('hidden');
          if (err.isBoom) {
            $("#getkey-error").text(err.output.payload.message);
          } else{
            $("#getkey-error").text(err.responseText);
          }
        });
    } else {
      authorize();
    }
  }

  //=================================
  function authorize() {
    webAuth.authorize({
      connection: 'google-oauth2',
      connection_scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      approvalPrompt: 'force'
    });
  }

  //=================================

  $('.navbar li').click(function(){
      $('.nav li').removeClass('active');
      $(this).addClass('active');
  })
  // ***************************
  
  function setSession(authResult) {
    // Set the time that the access token will expire at
    var expiresAt = JSON.stringify(
      // authResult.expiresIn * 1000 + new Date().getTime()
      // Instead using token's expiresIn, always set session expires in 15 minutes (900s)
      900 * 1000 + new Date().getTime()
    );
    localStorage.setItem('access_token', authResult.accessToken);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('expires_at', expiresAt);
    localStorage.setItem('auth_at', JSON.stringify(Date.now()));
  }

  function logout() {
    // Remove tokens and expiry time from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    // clearTimeout(tokenRenewalTimeout);
    displayButtons();
  }

  function isAuthenticated() {
    // Check whether the current time is past the
    // access token's expiry time
    var expiresAt = JSON.parse(localStorage.getItem('expires_at'));
    return new Date().getTime() < expiresAt;
  }

  function displayButtons() {
    // var loginStatus = document.querySelector('.container h4');
    if (isAuthenticated()) {
      loginBtn.addClass('hidden');
      logoutBtn.removeClass('hidden');
    } else {
      loginBtn.removeClass('hidden');
      logoutBtn.addClass('hidden');
    }
  }

  function handleAuthentication() {
    webAuth.parseHash(function(err, authResult) {
      if (authResult && authResult.accessToken && authResult.idToken) {
        window.location.hash = '';
        setSession(authResult);
        loginBtn.addClass('hidden');
        homeView.removeClass('hidden');
      } else if (err) {
        homeView.removeClass('hidden');
        console.log(err);
        alert(
          'Error: ' + err.error + '. Check the console for further details.'
        );
      }
      displayButtons();
    });
  }

  handleAuthentication();
});
