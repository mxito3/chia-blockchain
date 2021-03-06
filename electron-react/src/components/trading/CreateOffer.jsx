import { useDispatch, useSelector } from 'react-redux';
import React from 'react';
import { Trans } from '@lingui/macro';
import { useHistory } from 'react-router';
import {
  Box,
  Typography,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Button,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import isElectron from 'is-electron';
import { newBuy, newSell, addTrade, resetTrades } from '../../modules/trade';
import {
  chia_to_mojo,
  mojo_to_chia_string,
  colouredcoin_to_mojo,
} from '../../util/chia';
import { openDialog } from '../../modules/dialog';
import { create_trade_action } from '../../modules/trade_messages';
import { COLOURED_COIN } from '../../util/wallet_types';

const useStyles = makeStyles((theme) => ({
  toolbar: {
    paddingRight: 24, // keep right padding when drawer closed
  },
  toolbarIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 8px',
    ...theme.mixins.toolbar,
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  paper: {
    margin: theme.spacing(3),
    padding: theme.spacing(0),
  },
  balancePaper: {
    marginTop: theme.spacing(2),
  },
  copyButton: {
    marginTop: theme.spacing(0),
    marginBottom: theme.spacing(0),
    width: 50,
    height: 56,
  },
  cardTitle: {
    paddingLeft: theme.spacing(1),
    paddingTop: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
  cardSubSection: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
    paddingTop: theme.spacing(1),
  },
  tradeSubSection: {
    color: '#cccccc',
    borderRadius: 4,
    backgroundColor: '#555555',
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(3),
    marginTop: theme.spacing(1),
    padding: 15,
    overflowWrap: 'break-word',
  },
  formControl: {
    widht: '100%',
  },
  input: {
    height: 56,
    width: '100%',
  },
  send: {
    marginLeft: theme.spacing(2),
    paddingLeft: '0px',
    height: 56,
    width: 150,
  },
  card: {
    paddingTop: theme.spacing(10),
    height: 200,
  },
  saveButton: {
    width: '100%',
    marginTop: theme.spacing(4),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(2),
    height: 56,
  },
  cancelButton: {
    width: '100%',
    marginTop: theme.spacing(4),
    marginLeft: theme.spacing(1),
    marginBottom: theme.spacing(2),
    height: 56,
  },
  dragContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20,
  },
  drag: {
    backgroundColor: '#888888',
    height: 300,
    width: '100%',
  },
  dragText: {
    margin: 0,
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  circle: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const TradeList = () => {
  const classes = useStyles();

  const trades = useSelector((state) => state.trade_state.trades);
  const wallets = useSelector((state) => state.wallet_state.wallets);

  return (
    <Grid item xs={12}>
      <div className={classes.tradeSubSection}>
        <Box display="flex" style={{ minWidth: '100%' }}>
          <Box flexGrow={1}>
            <Trans id="TradeList.side">Side</Trans>
          </Box>
          <Box flexGrow={1}>
            <Trans id="TradeList.amount">Amount</Trans>
          </Box>
          <Box
            style={{
              marginRight: 10,
              width: '40%',
              textAlign: 'right',
              overflowWrap: 'break-word',
            }}
          >
            <Trans id="TradeList.colour">Colour</Trans>
          </Box>
        </Box>
        {trades.map((trade) => (
          <Box display="flex" style={{ minWidth: '100%' }}>
            <Box flexGrow={1}>{trade.side}</Box>
            <Box flexGrow={1}>{mojo_to_chia_string(trade.amount)}</Box>
            <Box
              style={{
                marginRight: 10,
                width: '40%',
                textAlign: 'right',
                overflowWrap: 'break-word',
              }}
            >
              {wallets[trade.wallet_id].name}
            </Box>
          </Box>
        ))}
      </div>
    </Grid>
  );
};

export default function CreateOffer() {
  const wallets = useSelector((state) => state.wallet_state.wallets);
  const classes = useStyles();
  const dispatch = useDispatch();
  const history = useHistory();
  let amount_input = null;
  let buy_or_sell = null;
  let wallet_id = null;
  const trades = useSelector((state) => state.trade_state.trades);

  function add() {
    if (!wallet_id.value) {
      dispatch(
        openDialog(
          '',
          <Trans id="CreateOffer.selectCoinType">
            Please select coin type
          </Trans>,
        ),
      );
      return;
    }
    if (amount_input.value === '') {
      dispatch(
        openDialog(
          '',
          <Trans id="CreateOffer.selectAmount">Please select amount</Trans>,
        ),
      );
      return;
    }
    if (!buy_or_sell.value) {
      dispatch(
        openDialog(
          '',
          <Trans id="CreateOffer.selectBuyOrSell">
            Please select buy or sell
          </Trans>,
        ),
      );
      return;
    }
    let mojo = chia_to_mojo(amount_input.value);
    if (wallets[wallet_id.value].type === COLOURED_COIN) {
      mojo = colouredcoin_to_mojo(amount_input.value);
    }
    let trade = null;
    if (buy_or_sell.value === 1) {
      trade = newBuy(mojo, wallet_id.value);
    } else {
      trade = newSell(mojo, wallet_id.value);
    }
    dispatch(addTrade(trade));
  }
  async function save() {
    console.log(trades.length);
    if (trades.length === 0) {
      dispatch(
        openDialog(
          '',
          <Trans id="CreateOffer.addTradePair">Please add trade pair</Trans>,
        ),
      );
      return;
    }
    if (isElectron()) {
      const dialogOptions = {};
      const result = await window.remote.dialog.showSaveDialog(dialogOptions);
      const { filePath } = result;
      const offer = {};
      for (const trade of trades) {
        if (trade.side === 'buy') {
          offer[trade.wallet_id] = trade.amount;
        } else {
          offer[trade.wallet_id] = -trade.amount;
        }
      }
      dispatch(create_trade_action(offer, filePath, history));
    } else {
      dispatch(
        openDialog(
          '',
          <Trans id="CreateOffer.availableOnlyFromElectron">
            This feature is available only from electron app
          </Trans>,
        ),
      );
    }
  }
  function cancel() {
    dispatch(resetTrades());
  }

  return (
    <Paper className={classes.paper}>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <div className={classes.cardTitle}>
            <Typography component="h6" variant="h6">
              <Trans id="CreateOffer.title">Create Trade Offer</Trans>
            </Typography>
          </div>
        </Grid>
        <TradeList />
        <Grid item xs={12}>
          <div className={classes.cardSubSection}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl
                  fullWidth
                  variant="outlined"
                  className={classes.formControl}
                >
                  <InputLabel>Buy or Sell</InputLabel>
                  <Select
                    inputRef={(input) => {
                      buy_or_sell = input;
                    }}
                    label={
                      <Trans id="CreateOffer.buyOrSell">Buy Or Sell</Trans>
                    }
                  >
                    <MenuItem value={1}>Buy</MenuItem>
                    <MenuItem value={2}>Sell</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl
                  fullWidth
                  variant="outlined"
                  className={classes.formControl}
                >
                  <InputLabel>Colour</InputLabel>
                  <Select
                    inputRef={(input) => {
                      wallet_id = input;
                    }}
                    label={<Trans id="CreateOffer.colour">Colour</Trans>}
                  >
                    {wallets.map((wallet) => (
                      <MenuItem value={wallet.id}>{wallet.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </div>
        </Grid>
        <Grid item xs={12}>
          <div className={classes.cardSubSection}>
            <Box display="flex">
              <Box flexGrow={1}>
                <TextField
                  className={classes.input}
                  fullWidth
                  inputRef={(input) => {
                    amount_input = input;
                  }}
                  label={<Trans id="CreateOffer.amount">Amount</Trans>}
                  variant="outlined"
                />
              </Box>
              <Box>
                <Button
                  onClick={add}
                  className={classes.send}
                  variant="contained"
                  color="primary"
                >
                  <Trans id="CreateOffer.add">Add</Trans>
                </Button>
              </Box>
            </Box>
          </div>
        </Grid>
        <Grid item xs={12}>
          <div className={classes.cardSubSection}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button
                  onClick={save}
                  className={classes.saveButton}
                  variant="contained"
                  color="primary"
                >
                  <Trans id="CreateOffer.save">Save</Trans>
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  onClick={cancel}
                  className={classes.cancelButton}
                  variant="contained"
                  color="primary"
                >
                  <Trans id="CreateOffer.cancel">Cancel</Trans>
                </Button>
              </Grid>
            </Grid>
          </div>
        </Grid>
      </Grid>
    </Paper>
  );
}
