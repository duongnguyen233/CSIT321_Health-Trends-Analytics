import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Avatar,
  Grid,
  Card,
  Divider,
} from "@mui/material";
import { Search, Bell } from "lucide-react";
import SimpleChart from '../components/SimpleChart'
import SimplePieChart from '../components/SimplePieChart'

export default function Dashboard() {
  return (
    <Box sx={{ backgroundColor: "#f5f7fb", minHeight: "100vh", p: 3 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <TextField
          variant="outlined"
          size="small"
          placeholder="Search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            ),
          }}
          sx={{
            backgroundColor: "white",
            borderRadius: "8px",
            width: "30%",
          }}
        />
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="contained"
            sx={{
              backgroundColor: "#5a67d8",
              textTransform: "none",
              fontWeight: "bold",
              borderRadius: "12px",
            }}
          >
            This Week
          </Button>
          <Bell size={24} color="#5a67d8" />
          <Avatar
            src="https://imgcdn.stablediffusionweb.com/2024/3/30/68e909a4-34e6-403d-97fc-72cee0558af0.jpg"
            alt="User"
            sx={{ width: 50, height: 50 }}
          />
        </Box>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={9}>
          <Card
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 4,
              mb: 3,
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Box>
              <Typography
                variant="h5"
                fontWeight="bold"
                sx={{ color: "#2d3748" }}
              >
                Hello,{" "}
                <Typography
                  component="span"
                  variant="h5"
                  fontWeight="bold"
                  sx={{ color: "#ffd700" }}
                >
                  Emma Shelton
                </Typography>
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ color: "#718096", mt: 1 }}
              >
                Have a nice day and don’t forget to take care of your health!
              </Typography>
              <Button
                variant="text"
                sx={{ textTransform: "none", mt: 2, fontWeight: "bold" }}
              >
                Read more
              </Button>
            </Box>
            <Avatar
              src="https://imgcdn.stablediffusionweb.com/2024/3/30/68e909a4-34e6-403d-97fc-72cee0558af0.jpg"
              alt="Doctor"
              sx={{ width: 100, height: 100 }}
            />
          </Card>
          <Grid container spacing={3}>
            {[
              {
                title: "Heart rate",
                value: "102 bpm",
                description:
                  "Pulse is the most important physiological indicator.",
                color: "#f56565",
              },
              {
                title: "Temperature",
                value: "36.6°C",
                description: "Temperature balance for health.",
                color: "#48bb78",
              },
              {
                title: "Blood pressure",
                value: "120/80",
                description: "Normal blood pressure ensures health.",
                color: "#4299e1",
              },
              {
                title: "Glucose",
                value: "90 mg/dl",
                description: "Normal glucose levels are vital.",
                color: "#d69e2e",
              },
            ].map((item, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  sx={{
                    p: 3,
                    borderRadius: "16px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    borderLeft: `8px solid ${item.color}`,
                    height: "100%",
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{ color: "#2d3748" }}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight="bold"
                    sx={{ color: item.color, mt: 1 }}
                  >
                    {item.value}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "#718096", mt: 1 }}
                  >
                    {item.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={3} mt={3}>
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  p: 4,
                  borderRadius: "16px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
              >
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ color: "#2d3748" }}
                >
                  Water Balance
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight="bold"
                  sx={{ color: "#4299e1", mt: 2 }}
                >
                  42%
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#718096", mt: 1 }}
                >
                  10% less than last week.
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  p: 4,
                  borderRadius: "16px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
              >
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ color: "#2d3748" }}
                >
                  General Health
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight="bold"
                  sx={{ color: "#48bb78", mt: 2 }}
                >
                  61%
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#718096", mt: 1 }}
                >
                  Slightly higher than last week.
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card
            sx={{
              p: 3,
              textAlign: "center",
              mb: 3,
              backgroundColor: "#5a67d8",
              color: "white",
              borderRadius: "16px",
            }}
          >
            <Avatar
              src="https://imgcdn.stablediffusionweb.com/2024/3/30/68e909a4-34e6-403d-97fc-72cee0558af0.jpg"
              alt="Emma Shelton"
              sx={{ width: 100, height: 100, mx: "auto", mb: 2 }}
            />
            <Typography variant="h6">Emma Shelton</Typography>
            <Typography variant="body2">21 years</Typography>
            <Divider sx={{ my: 2, borderColor: "white" }} />
            <Box display="flex" justifyContent="space-around">
              <Typography>
                <strong>53 kg</strong>
              </Typography>
              <Typography>
                <strong>163 cm</strong>
              </Typography>
              <Typography>
                <strong>8h 30m</strong>
              </Typography>
            </Box>
          </Card>
          <Card
            sx={{
              p: 3,
              borderRadius: "16px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Typography variant="h6" fontWeight="bold" mb={2}>
              April 2021
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              mb={2}
              sx={{ color: "#718096" }}
            >
              Appointments
            </Typography>
            {[{ title: "Dentist", time: "10 AM", color: "#f56565" },
            { title: "Oculist", time: "12 PM", color: "#48bb78" },
            { title: "Cardiologist", time: "2 PM", color: "#4299e1" }].map((appointment, index) => (
              <Box
                key={index}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                p={2}
                mb={1}
                sx={{
                  backgroundColor: appointment.color,
                  color: "white",
                  borderRadius: "8px",
                }}
              >
                <Typography>{appointment.title}</Typography>
                <Typography>{appointment.time}</Typography>
              </Box>
            ))}
          </Card>
        </Grid>
      </Grid>
      {/* Duong add saample charts */}
      <Grid container spacing={3}>
        {/* Bar Chart */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              p: 3,
              borderRadius: "16px",
              backgroundColor: "white",
              color: "white",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Users (Bar)
            </Typography>
            <SimpleChart
              metric="users"
              chartType="bar"
              locale="de-DE"
              fractionDigits={1}
            />
          </Card>
        </Grid>

        {/* Line Chart */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              p: 3,
              borderRadius: "16px",
              backgroundColor: "white",
              color: "white",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Users (Line)
            </Typography>
            <SimpleChart
              metric="users"
              chartType="line"
              locale="de-DE"
              fractionDigits={1}
            />
          </Card>
        </Grid>

        {/* Pie Chart */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              p: 3,
              borderRadius: "16px",
              backgroundColor: "white",
              color: "white",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Distribution
            </Typography>
            <SimplePieChart />
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
