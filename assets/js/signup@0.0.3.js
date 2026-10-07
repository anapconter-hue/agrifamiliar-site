//: Utils

function scrollToView(element){
    var offset = element.offset().top;
    var visible_area_start = $(window).scrollTop();
    var visible_area_end = visible_area_start + window.innerHeight;

    if(offset < visible_area_start || offset > visible_area_end){
         // Not in view so scroll to it
         $('html,body').animate({scrollTop: offset - window.innerHeight + element.innerHeight() + 10}, 500);
         return false;
    }
    return true;
}

// :: Validation
function isValidEmail(email) {
    if (!email) {
        return false;
    }

    var re = /^[^\s@]+@[^\s@]+$/;
    return re.test(email);
}

function isValidCPF(cpf) {
    if (typeof cpf !== "string")    {
        return false;
    }

    cpf = cpf.replace(/[\s.-]*/igm, '')

    if (
        !cpf ||
        cpf.length != 11 ||
        cpf == "00000000000" ||
        cpf == "11111111111" ||
        cpf == "22222222222" ||
        cpf == "33333333333" ||
        cpf == "44444444444" ||
        cpf == "55555555555" ||
        cpf == "66666666666" ||
        cpf == "77777777777" ||
        cpf == "88888888888" ||
        cpf == "99999999999"
    ) {
        return false;
    }

    var soma = 0;
    var resto;
    for (var i = 1; i <= 9; i++)  {
        soma = soma + parseInt(cpf.substring(i-1, i)) * (11 - i);
    }

    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) {
        resto = 0;
    }

    if (resto != parseInt(cpf.substring(9, 10)) ) {
        return false;
    }

    soma = 0;
    for (var i = 1; i <= 10; i++) {
        soma = soma + parseInt(cpf.substring(i-1, i)) * (12 - i);
    }

    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) {
        resto = 0;
    }

    if (resto != parseInt(cpf.substring(10, 11) ) ) {
        return false;
    }

    return true;
}

function isValidCNPJ(cnpj) {

    if (!cnpj) {
        return false;
    }

    cnpj = cnpj.replace(/[^\d]+/g,'');

    if(cnpj === '') {
        return false;
    }

    if (cnpj.length != 14) {
        return false;
    }

    // Elimina CNPJs invalidos conhecidos
    if (cnpj == "00000000000000" ||
        cnpj == "11111111111111" ||
        cnpj == "22222222222222" ||
        cnpj == "33333333333333" ||
        cnpj == "44444444444444" ||
        cnpj == "55555555555555" ||
        cnpj == "66666666666666" ||
        cnpj == "77777777777777" ||
        cnpj == "88888888888888" ||
        cnpj == "99999999999999") {
        return false;
    }

    // Valida DVs
    var tamanho = cnpj.length - 2
    var numeros = cnpj.substring(0,tamanho);
    var digitos = cnpj.substring(tamanho);
    var soma = 0;
    var pos = tamanho - 7;
    for (i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2)
            pos = 9;
    }
    var resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0))
        return false;

    tamanho = tamanho + 1;
    numeros = cnpj.substring(0,tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2)
            pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1))
          return false;

    return true;
}

function isValidZipCode(zipCode) {
    if (!zipCode) {
        return false;
    }
    var re = /^[0-9]{2}.[0-9]{3}-[0-9]{3}$/;

    zipCode = zipCode.trim();

    return zipCode.length > 0 && re.test(zipCode);
}

//:: Mask directive
function maskDirective(el, binding) {
    if (!binding.value) {
        return;
    }

    // Check if mask changed
    var needUpdate = JSON.stringify(binding.value) !== JSON.stringify(binding.oldValue);

    if (binding.value && needUpdate) {
        return new Maska(el, { mask: JSON.stringify(binding.value) });
    }
}

function mask(value, mask, tokens, masked) {
    if (typeof masked === "undefined") {
        masked = true;
    }

    return (mask.length > 1)
        ? dynamic(mask)(value, mask, tokens, masked)
        : process(value, mask, tokens, masked);
}

// Decorator
function dynamic(mask) {
    mask = JSON.parse(mask);
    var masks = mask.sort(function(a, b) {
        return a.length - b.length;
    });

    return function(value, mask, tokens, masked) {
        if (typeof masked === "undefined") {
            masked = true;
        }

        var processed = masks.map(function(m) {
            return process(value, m, tokens, false);
        });

        var last = processed.pop();

        for (var i = 0; i<masks.length; i++) {
          if (checkMask(last, masks[i], tokens)) {
            return process(value, masks[i], tokens, masked)
          }
        }

        return '' // empty masks
  }

  function checkMask (variant, mask, tokens) {
    for (var tok = 0; tok<tokens.length; tok++) {
      if (tokens[tok].escape) {
        mask = mask.replace(new RegExp(tok + '.{1}', 'g'), '');
      }
    }

    return mask.split('').filter(function(el) {
        return tokens[el] && tokens[el].pattern;
    }).length >= variant.length;
  }
}

/**
    If the parameter "masked" is true, returns a masked string.

    @param {String} value: this is the masked value that comes from the HTML input.
    @param {String} mask: the mask to be used.
    @param {Object} tokens: this is a map where the key is a token character and the value is a configuration object.
*/
function process(value, mask, tokens, masked) {
    if (typeof masked === "undefined") {
         masked = true;
    }

    var im = 0; // index mask
    var iv = 0; // index value
    var ret = ''; // string to be returned
    var rest = ''; // remaining characters in mask

    while (im < mask.length && iv < value.length) {
        var maskChar = mask[im];
        var valueChar = value[iv];
        var token = tokens[maskChar];

        if (token && token.pattern) {
            if (token.pattern.test(valueChar)) { // We found a token that must be replaced
                ret += tokenTransform(valueChar, token);
                im++;
                // check next char
                if (masked && mask[im] && !tokens[mask[im]]) { // If the next char is not a replaceable token, but a fixed one, then append it
                    ret += mask[im];
                    im++;
                }
            }
            iv++;
        } else if (token && token.repeat) {
            var tokenPrev = tokens[mask[im - 1]]
            if (tokenPrev && !tokenPrev.pattern.test(valueChar)) {
                im++;
            } else {
                im--;
            }
        } else {
            if (token && token.escape) {
                im++;
                maskChar = mask[im];
            }
            if (masked) ret += maskChar;
            if (valueChar === maskChar) iv++;
            im++;
        }
    }

    // fix mask that ends with parenthesis
    while (masked && im < mask.length) { // eslint-disable-line no-unmodified-loop-condition
        var maskCharRest = mask[im];
        if (tokens[maskCharRest]) {
            rest = '';
            break;
        }
        rest += maskCharRest;
        im++;
    }

    return ret + rest;
}

/**
    Replaces a token with the value that the user typed.
    This function is just to enable transforming the typed text (lowercasing/uppercasing/etc.)
    otherwise a simple str.replace would have been enough.

    @param {String} value: this will be the single character that the user typed
    @param {String} token: this will be the corresponding token in the same position in the mask

*/
function tokenTransform (value, token) {
    if (token.transform) {
        value = token.transform(value);
    }

    if (token.uppercase) {
        return value.toLocaleUpperCase();
    } else if (token.lowercase) {
        return value.toLocaleLowerCase();
    }

    return value;
}

/**
    Modifies the position of the cursor.
*/
function fixInputSelection(el, position, digit) {
    while (position && position < el.value.length && el.value.charAt(position - 1) !== digit) {
        position++
    }

    var selectionRange = el.type ? el.type.match(/^(text|search|password|tel|url)$/i) : !el.type;
    if (selectionRange && el === document.activeElement) {
        el.setSelectionRange(position, position);
        setTimeout(function () {
            el.setSelectionRange(position, position)
        }, 0);
    }
}

/**
    Creates a browser event;
*/
function event(name, inputType) {
    if (typeof inputType === "undefined") {
        inputType = null;
    }
    var event = document.createEvent('Event');
    event.initEvent(name, true, true);
    if (inputType) {
        event.inputType = inputType;
    }

    return event;
}

/**
    Javascript class that will manage an HTML input.
    It will listen to the input events and modify the input's value accordingly.
*/
function Maska(el, opts) {
    if (!el) {
        throw new Error('Maska: no element for mask');
    }

    this._opts = {
      mask: opts.mask,
      tokens: {
        '#': { pattern: /[0-9]/ },
        'X': { pattern: /[0-9a-zA-Z]/ },
        'S': { pattern: /[a-zA-Z]/ },
        'A': { pattern: /[a-zA-Z]/, uppercase: true },
        'a': { pattern: /[a-zA-Z]/, lowercase: true },
        '!': { escape: true },
        '*': { repeat: true }
      }
    };

    this._el = [el];

    this.init()
}

/**
    Sets up the event listeners and stores the following values
    in the element's dataset:
        - mask: the mask assigned to the element
        - maskInitialized: a boolean inidicating that the event listener have already been added to the element
*/
Maska.prototype.init = function() {
    for (var i = 0; i < this._el.length; i++) {
        var el = this._el[i];
        if (this._opts.mask && (!el.dataset.mask || el.dataset.mask !== this._opts.mask)) {
            el.dataset.mask = this._opts.mask;
        }
        this.updateValue(el);
        if (!el.dataset.maskInitialized) {
            el.dataset.maskInitialized = true;
            var self = this;

            el.addEventListener('input', function(evt) {
                self.updateValue(evt.target, evt);
            });

            el.addEventListener('beforeinput', function(evt) {
                self.beforeInput(evt);
            });
        }
    }
};

/**
    Called after the user types a character.
    This will mask the string in the input element and update the input's value.
    The raw unmasked value is stored in the element's dataset with key "maskRawValue".
*/
Maska.prototype.updateValue = function(el, evt) {
    var wrongNum = el.type.match(/^number$/i) && el.validity.badInput;

    if ((!el.value && !wrongNum) || !el.dataset.mask) {
        el.dataset.maskRawValue = '';
        this.dispatch('mask', el, evt);
        return
    }

    var position = el.selectionEnd;
    var oldValue = el.value;
    var digit = oldValue[position - 1];

    el.dataset.maskRawValue = mask(el.value, el.dataset.mask, this._opts.tokens, false);
    el.value = mask(el.value, el.dataset.mask, this._opts.tokens);

    if (evt && evt.inputType === 'insertText' && position === oldValue.length) {
        position = el.value.length;
    }
    fixInputSelection(el, position, digit);

    this.dispatch('mask', el, evt);
    if (el.value !== oldValue) {
        this.dispatch('input', el, evt);
    }
};

/**
    Prevents entering non-numeric values for type=number inputs
*/
Maska.prototype.beforeInput = function(e) {

    if (e.target.type.match(/^number$/i) && e.data && isNaN(e.target.value + e.data)) {
        e.preventDefault();
    }
}

/**
    Dispatches an event.

    This will be used to dispatch 2 events:
        - "mask": whenever there are any changes with the input element
        - "input": whenever the resulting masked value changed
*/
Maska.prototype.dispatch = function(name, el, evt) {
    el.dispatchEvent(event(name, (evt && evt.inputType) || null));
}

Vue.directive('mask', maskDirective);

//: Global store
var store = {
    signupData: {
        // Access data
        person_type: "",
        cpf_cnpj: undefined,
        name: undefined,
        email: undefined,
        password: undefined,

        // Address data
        address_street: undefined,
        address_street_number: undefined,
        address_extra: undefined,
        address_neighborhood: undefined,
        address_zipcode: undefined,
        phone_ddd: undefined,
        phone_number: undefined,

        // Payment data
        payment_method: undefined,
        card_hash: undefined,
        plan_id: undefined,
    }
};

//: Pagar.me

function getCreditCardHash(amount) {
    return new Promise(function(resolve, reject) {
        var checkout = new PagarMeCheckout.Checkout({
          encryption_key: window.config.encryption_key,
          success: function(data) {
            resolve(data["card_hash"]);
          },
          error: function(err) {
            console.log(err);
            reject(["Ocorreu um erro. Tente novamente"]);
          },
          close: function() {
            reject([]);
          }
        });

        checkout.open({
          uiColor: '#5dc596',
          paymentButtonText: "Confirmar",
          paymentMethods: 'credit_card',
          customerData: 'false', // não é necessário para a captura.
          createToken: 'false', // não é uma transação, e sim uma captura.
        });

    });
}

//: API
function SignupAPIMock() {

    var mockDelay = 500;

    return {
        validateAccessData: function(signupData) {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                    // reject(["CPF inválido."]);
                }, mockDelay);
            });
        },
        validateZipCode: function(zipCode) {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve({
                        "address_street": "Rua Teste",
                        "address_neighborhood": "Bairro Teste"
                    });
                    // reject(["O CEP informado não é um CEP válido. Verifique e tente novamente."]);
                }, mockDelay);
            })
        },
        validateAddressData: function(signupData) {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                    // reject(["Endereço inexistente."]);
                }, mockDelay);
            });
        },
        confirmSignup: function(signupData) {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, mockDelay);
            });
        }
    }
}

function SignupAPI() {
    return {
        validateAccessData: function(signupData) {
            var csrfToken = getCSRFToken();
            return fetch(
                "/api/auth/validate-access-data/",
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(signupData)
                }
            ).then(function(response) {
                if (response.status === 400) {
                    return response.json().then(function(errors) {
                        throw errors;
                    });
                } else if (!response.ok) {
                    throw ["Ocorreu um erro. Tente novamente."];
                }
            });
        },
        validateZipCode: function(zipCode) {
            var csrfToken = getCSRFToken();
            return fetch(
                "/api/auth/validate-zip-code/",
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({"zip_code": zipCode})
                }
            ).then(function(response) {
                if (response.status === 400) {
                    return response.json().then(function(errors) {
                        throw errors;
                    });
                } else if (!response.ok) {
                    throw ["Ocorreu um erro. Tente novamente."];
                } else {
                    return response.json();
                }
            });
        },
        validateAddressData: function(signupData) {
            var csrfToken = getCSRFToken();
            return fetch(
                "/api/auth/validate-address-data/",
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(signupData)
                }
            ).then(function(response) {
                if (response.status === 400) {
                    return response.json().then(function(errors) {
                        throw errors;
                    });
                } else if (!response.ok) {
                    throw ["Ocorreu um erro. Tente novamente."];
                }
            });
        },
        confirmSignup: function(signupData) {
            var csrfToken = getCSRFToken();
            return fetch(
                window.confirmationURL,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(signupData)
                }
            ).then(function(response) {
                if (response.status === 400) {
                    return response.json().then(function(errors) {
                        throw errors;
                    });
                } else if (!response.ok) {
                    throw ["Ocorreu um erro. Tente novamente."];
                }
            });
        }
    }
}

var signupAPI;

if (MOCK) {
    signupAPI = SignupAPIMock();
} else {
    signupAPI = SignupAPI();
}

//: Spinner
Vue.component("spinner", {
    template: "#spinner-template",
    props: {
        loading: {
            type: Boolean,
            default: true
        },
        color: {
            type: String,
            default: '#5dc596'
        },
        size: {
            type: String,
            default: '15px'
        },
        margin: {
            type: String,
            default: '2px'
        },
        radius: {
            type: String,
            default: '100%'
        }
    },
    data: function () {
        return {
            spinnerStyle: {
                backgroundColor: this.color,
                width: this.size,
                height: this.size,
                margin: this.margin,
                borderRadius: this.radius,
                display: 'inline-block',
                animationName: 'v-pulseStretchDelay',
                animationDuration: '0.75s',
                animationIterationCount: 'infinite',
                animationTimingFunction: 'cubic-bezier(.2,.68,.18,1.08)',
                animationFillMode: 'both'
            },
            spinnerDelay1: {
                animationDelay: '0.12s'
            },
            spinnerDelay2: {
                animationDelay: '0.24s'
            },
            spinnerDelay3: {
                animationDelay: '0.36s'
            }
        }
    }
});

//: Loading text
Vue.component("loading-text", {
    template: "#loading-text-template",
    props: ["text", "loading", "color"]
});

//: Header
Vue.component("app-header", {
    template: "#header-template",
    props: ["title", "subtitle", "text"]
});

//: Access data
Vue.component("access-data", {
    template: "#access-data-template",
    data: function() {
        return {
            signupData: window.store.signupData,
            confirmPassword: undefined,
            errors: [],
            loading: false
        };
    },
    methods: {
        getUsernamePlaceholder: function() {
            if (!this.signupData.person_type) {
                return "CPF ou CNPJ";
            } else {
                if (this.signupData.person_type === "PF") {
                    return "CPF";
                } else {
                    return "CNPJ";
                }
            }
        },
        getUsernameMask: function() {
            if (!this.signupData.person_type) {
                return ["###.###.###-##", "##.###.###/####-##"];
            } else {
                if (this.signupData.person_type === "PF") {
                    return ["###.###.###-##"];
                } else {
                    return ["##.###.###/####-##"];
                }
            }
        },
        getNamePlaceholder: function() {
            if (!this.signupData.person_type) {
                return "Nome ou razão social";
            } else {
                if (this.signupData.person_type === "PF") {
                    return "Nome";
                } else {
                    return "Razão social";
                }
            }
        },
        onContinue: function() {
            var self = this;
            self.loading = true;
            self.errors = [];
            self.signupData.cpf_cnpj = self.signupData.cpf_cnpj.replace(/[^\d]/g, '');
            signupAPI.validateAccessData(self.signupData).then(function() {
                self.loading = false;
                self.$emit("continue");

            }).catch(function(errors) {
                self.loading = false;
                self.errors = errors;
            });
        },
        checkForm: function() {
            if (!this.signupData.person_type) {
                return false;
            }

            if (!isValidCPF(this.signupData.cpf_cnpj) && ! isValidCNPJ(this.signupData.cpf_cnpj)) {
                return false;
            }

            if (!this.signupData.name) {
                return false;
            }

            if (!isValidEmail(this.signupData.email)) {
                return false;
            }

            if (!this.signupData.password || this.signupData.password.trim().length === 0) {
                return false;
            }

            if (this.signupData.password != this.confirmPassword) {
                return false;
            }

            return true;
        }
    }
});

//: Address data
Vue.component("address-data", {
    template: "#address-data-template",
    data: function() {
        return {
            signupData: window.store.signupData,
            errors: [],
            loading: false, // flag for showing that validation is running for all the data
            loadingZipCode: false, // flag for showing that the zip code is being checked
            validZipCode: false // flag to indicate that zip code was checked and is valid
        }
    },
    computed: { // This is necessary for watching changes to the zip code
        zipCode: function() {
            return this.signupData.address_zipcode;
        }
    },
    watch: {
        zipCode: function(newVal, oldVal) {
            if (newVal !== oldVal && isValidZipCode(newVal)) {
                this.validateZipCode(newVal);
            } else if (!isValidZipCode(newVal)) {
                this.errors = [];
            }
        }
    },
    methods: {
        onContinue: function() {
            var self = this;
            self.loading = true;
            self.errors = [];

            signupAPI.validateAddressData(this.signupData).then(function() {
                self.loading = false;
                self.$emit("continue");

            }).catch(function(errors) {
                self.loading = false;
                self.errors = errors;
            });
        },
        onBack: function() {
            this.$emit("back");
        },
        validateZipCode: function(zipCode) {
            var self = this;
            self.loadingZipCode = true;
            var clearZipCode = zipCode.replace(/[.-]/g, "");
            signupAPI.validateZipCode(clearZipCode).then(function(data) {
                self.signupData.address_street = data.address_street;
                self.signupData.address_neighborhood = data.address_neighborhood;
                self.loadingZipCode = false;
                self.validZipCode = true;
            }).catch(function(errors) {
                self.loadingZipCode = false;
                self.validZipCode = false;
                self.errors = errors;
            });
        },
        checkForm: function() {
            if (!this.signupData.address_street || this.signupData.address_street.trim().length === 0) {
                return false;
            }

            if (!this.signupData.address_street_number || this.signupData.address_street_number.trim().length === 0) {
                return false;
            }

            if (!this.signupData.address_neighborhood || this.signupData.address_neighborhood.trim().length === 0) {
                return false;
            }

            if (!isValidZipCode(this.signupData.address_zipcode)) {
                return false;
            }

            if (!this.signupData.phone_ddd || this.signupData.phone_ddd.trim().length !== 2) {
                return false;
            }

            if (!this.signupData.phone_number || this.signupData.phone_number.trim().length < 8) {
                return false;
            }

            return true;
        }
    }
});

//: Plan selection
Vue.component("plan-selection", {
    template: "#plan-selection-template",
    data: function() {
        return {
            signupData: window.store.signupData,
            plans: window.config.plans,
        };
    },
    methods: {
        onSelect: function(plan) {
            this.signupData.plan_id = plan.plan_id;

            scrollToView($(".plan-selection .buttons-wrapper"));
        },
        onContinue: function() {
            this.$emit("continue");
        },
        onBack: function() {
            this.$emit("back");
        },
    }
});

//:: Plan item
Vue.component("plan-item", {
    template: "#plan-item-template",
    props: ["plan", "isSelected"],
});

//: Payment method selection
Vue.component("payment-method-selection", {
    template: "#payment-method-selection",
    data: function() {
        return {
            signupData: window.store.signupData,
            payment_methods: window.config.payment_methods,
            loading: false,
            errors: [],
            confirmText: window.confirmText
        };
    },
    methods: {
        onSelect: function(plan) {
            this.signupData.payment_method = plan.payment_method;

            scrollToView($(".payment-method-selection .buttons-wrapper"));
        },
        onContinue: function() {
            // Cleaning masks
            if (!!this.signupData.cpf_cnpj) {
                this.signupData.cpf_cnpj = this.signupData.cpf_cnpj.replace(/[.-]/g, "");
            }
            this.signupData.address_zipcode = this.signupData.address_zipcode.replace(/[.-]/g, "");
            this.signupData.phone_number = this.signupData.phone_number.replace(/-/g, "");

            if (this.signupData.payment_method === "credit_card") {
                var self = this;
                self.loading = true;
                getCreditCardHash().then(function(cardHash) {
                    self.signupData.card_hash = cardHash;
                    self.confirmSignup();
                }).catch(function(errors) {
                    self.loading = false;
                    self.errors = errors;
                });
            } else {
                this.confirmSignup();
            }
        },
        confirmSignup: function() {
            var self = this;
            self.loading = true;
            signupAPI.confirmSignup(this.signupData).then(function() {
                self.$emit("continue");
                self.loading = false;
            }).catch(function(errors) {
                self.loading = false;
                self.errors = errors;
            });
        },
        onBack: function() {
            this.$emit("back");
        },
    }
});

// :: Payment method item
Vue.component("payment-method-item", {
    template: "#payment-method-item-template",
    props: ["method", "isSelected"],
});

// :: Success feedback
Vue.component("success-feedback", {
    template: "#success-feedback-template",
});

//: App
$(document).ready(function() {
    var app = new Vue({
        el: "#app-entrypoint",
        template: "#app-template",
        data: function() {
            return {
                currentStep: 1,
                steps: window.steps,
            };
        },
        methods: {
            onBack: function() {
                this.currentStep -= 1;

                $([document.documentElement, document.body]).animate({
                    scrollTop: 0
                }, 1000);
            },
            onContinue: function() {
                this.currentStep += 1;

                // Scrolling to the top
                $([document.documentElement, document.body]).animate({
                    scrollTop: 0
                }, 1000);
            }
        }
    });
});