$(function() {
  $('[data-toggle="popover"]').popover({
    content: '\
    X         = Period <br /> \
    Y         = Comma <br /> \
    XX        = Colon <br /> \
    YY        = Dash/Hyphen/Slant <br /> \
    KK**KK    = Parenthesis <br /> \
    Y******Y  = Numbers, where QWERTY.... => 123456...',
    html: true,
    placement: 'bottom'
  });
})